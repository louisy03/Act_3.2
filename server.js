
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 8080;

// Configuración para usar EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'clave_secreta_segura',
    resave: false,
    saveUninitialized: false
}));

// Middleware para inyectar variable 'user' en todas las vistas
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  next();
});


// Base de datos
const dbPath = process.env.NODE_ENV === 'production' ? '/tmp/database.db' : 'database.db';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Error al abrir la base de datos:', err.message);
        process.exit(1);
    }
    console.log(`Conectado a SQLite en: ${dbPath}`);

    // Crear tablas
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            correo TEXT UNIQUE,
            password TEXT NOT NULL,
            rol TEXT DEFAULT 'usuario'
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS comentarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT NOT NULL,
            contenido TEXT NOT NULL,
            creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Crear superusuario automáticamente si no existe
        db.get("SELECT * FROM usuarios WHERE nombre = 'admin'", (err, row) => {
            if (err) return console.error('Error al verificar superusuario:', err.message);

            if (!row) {
                db.run(`INSERT INTO usuarios (nombre, correo, password, rol)
                        VALUES ('admin', 'admin@admin.com', '031204zLouisyz', 'admin')`,
                    (err) => {
                        if (err) {
                            console.error('❌ Error al crear superusuario:', err.message);
                        } else {
                            console.log('✅ Superusuario creado: admin@admin.com / 031204zLouisyz');
                        }
                    }
                );
            }
        });
    });
});

// Rutas principales
app.get('/', (req, res) => {
    db.all('SELECT * FROM comentarios ORDER BY creado_en DESC', (err, comentarios) => {
        if (err) {
            console.error(err);
            return res.render('error', { mensaje: 'Error al cargar comentarios' });
        }
        res.render('index', { comentarios });
    });
});

// Registro
app.get('/register', (req, res) => res.render('register'));
app.post('/register', (req, res) => {
  const { nombre, correo, password } = req.body;

  if (!nombre || !correo || !password) {
    return res.render('error', { mensaje: 'Todos los campos son obligatorios' });
  }

  db.run(
    'INSERT INTO usuarios (nombre, correo, password) VALUES (?, ?, ?)',
    [nombre, correo, password],
    (err) => {
      if (err) {
        console.error('Error al registrar usuario:', err.message);
        return res.render('error', { mensaje: `Error al registrar el usuario: ${err.message}` });
      }
      res.redirect('/login');
    }
  );
});


// Login
app.get('/login', (req, res) => res.render('login'));
app.post('/login', (req, res) => {
    const { nombre, password } = req.body;
    db.get('SELECT * FROM usuarios WHERE nombre = ? AND password = ?', [nombre, password], (err, usuario) => {
        if (err) {
            console.error('Error en consulta:', err);
            return res.render('error', { mensaje: 'Error en el servidor' });
        }
        if (!usuario) return res.render('error', { mensaje: 'Credenciales inválidas' });
        req.session.usuario = usuario;
        res.redirect('/');
    });
});


// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Comentar (requiere login)
app.post('/comentario', (req, res) => {
    if (!req.session.usuario) return res.redirect('/login');
    const contenido = req.body.contenido;
    const usuario = req.session.usuario.nombre;
    db.run('INSERT INTO comentarios (usuario, contenido) VALUES (?, ?)', [usuario, contenido], err => {
        if (err) console.error(err);
        res.redirect('/');
    });
});

// Eliminar comentario (solo superusuario)
app.get('/comentario/eliminar/:id', (req, res) => {
    if (!req.session.usuario || req.session.usuario.rol !== 'admin') {
        return res.status(403).render('error', { mensaje: 'Acceso denegado' });
    }
    const id = req.params.id;
    db.run('DELETE FROM comentarios WHERE id = ?', [id], err => {
        if (err) console.error(err);
        res.redirect('/');
    });
});

// Vista de error genérica
app.get('/error', (req, res) => res.render('error', { mensaje: 'Algo salió mal' }));

// 404
app.use((req, res) => res.status(404).render('error', { mensaje: 'Página no encontrada' }));

// Iniciar servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
});
