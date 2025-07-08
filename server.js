const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8080; // Usar 8080 para compatibilidad con Railway

// Configuración para usar EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para leer formularios
app.use(bodyParser.urlencoded({ extended: true }));

// Carpeta para archivos estáticos (imágenes, css)
app.use(express.static(path.join(__dirname, 'public')));

// Configuración robusta de la base de datos
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/database.db'  // Usa directorio temporal en producción (Railway)
  : 'database.db';      // Usa local en desarrollo

// Verificar/Crear directorio si no existe
if (process.env.NODE_ENV === 'production') {
  if (!fs.existsSync('/tmp')) {
    fs.mkdirSync('/tmp');
  }
}

const db = new sqlite3.Database(
  dbPath,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error('Error al abrir la base de datos:', err.message);
      process.exit(1); // Termina la aplicación si no puede conectar
    }
    console.log(`Conectado a SQLite en: ${dbPath}`);
    
    // Crear tabla si no existe
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS registros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla:', err);
        } else {
          console.log('Tabla "registros" verificada/creada');
        }
      });
    });
  }
);

// Manejo de errores de la base de datos
db.on('error', (err) => {
  console.error('Error en la base de datos:', err);
});

// Rutas

// Ruta principal que muestra lista de registros
app.get('/', (req, res) => {
  db.all('SELECT * FROM registros ORDER BY creado_en DESC', (err, registros) => {
    if (err) {
      console.error('Error al consultar registros:', err);
      return res.status(500).render('error', { 
        mensaje: 'Error al consultar la base de datos' 
      });
    }
    res.render('index', { registros });
  });
});

// Formulario para agregar registro
app.get('/add', (req, res) => {
  res.render('add');
});

app.post('/add', (req, res) => {
  const { nombre } = req.body;
  if (!nombre) {
    return res.status(400).render('error', { 
      mensaje: 'El nombre es requerido' 
    });
  }

  db.run('INSERT INTO registros (nombre) VALUES (?)', [nombre], function(err) {
    if (err) {
      console.error('Error al insertar:', err);
      return res.status(500).render('error', { 
        mensaje: 'Error al guardar el registro' 
      });
    }
    res.redirect('/');
  });
});

// Formulario para editar registro
app.get('/edit/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM registros WHERE id = ?', [id], (err, registro) => {
    if (err || !registro) {
      console.error('Error al consultar registro:', err);
      return res.status(404).render('error', { 
        mensaje: 'Registro no encontrado' 
      });
    }
    res.render('edit', { registro });
  });
});

app.post('/edit/:id', (req, res) => {
  const id = req.params.id;
  const { nombre } = req.body;
  
  if (!nombre) {
    return res.status(400).render('error', { 
      mensaje: 'El nombre es requerido' 
    });
  }

  db.run('UPDATE registros SET nombre = ? WHERE id = ?', [nombre, id], (err) => {
    if (err) {
      console.error('Error al actualizar:', err);
      return res.status(500).render('error', { 
        mensaje: 'Error al actualizar el registro' 
      });
    }
    res.redirect('/');
  });
});

// Eliminar registro
app.get('/delete/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM registros WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error al eliminar:', err);
      return res.status(500).render('error', { 
        mensaje: 'Error al eliminar el registro' 
      });
    }
    res.redirect('/');
  });
});

// Ver registro individual
app.get('/view/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM registros WHERE id = ?', [id], (err, registro) => {
    if (err || !registro) {
      console.error('Error al consultar registro:', err);
      return res.status(404).render('error', { 
        mensaje: 'Registro no encontrado' 
      });
    }
    res.render('view', { registro });
  });
});

// Middleware para manejar errores 404
app.use((req, res) => {
  res.status(404).render('error', { 
    mensaje: 'Página no encontrada' 
  });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Base de datos: ${dbPath}`);
});

// Manejo de cierre limpio
process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});