const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configuración para usar EJS
app.set('view engine', 'ejs');

// Middleware para leer formularios
app.use(bodyParser.urlencoded({ extended: true }));

// Carpeta para archivos estáticos (imágenes, css)
app.use(express.static(path.join(__dirname, 'public')));

// Crear y conectar base de datos SQLite
const db = new sqlite3.Database('database.db');

// Crear tabla si no existe
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL
  )`);
});

// Rutas

// Ruta principal que muestra lista de registros
app.get('/', (req, res) => {
  db.all('SELECT * FROM registros', (err, registros) => {
    if (err) {
      return res.status(500).send('Error al consultar la base de datos');
    }
    res.render('index', { registros });
  });
});

// Formulario para agregar registro
app.get('/add', (req, res) => {
  res.render('add');
});

app.post('/add', (req, res) => {
  const nombre = req.body.nombre;
  db.run('INSERT INTO registros (nombre) VALUES (?)', [nombre], err => {
    if (err) {
      return res.status(500).send('Error al insertar en la base de datos');
    }
    res.redirect('/');
  });
});

// Formulario para editar registro
app.get('/edit/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM registros WHERE id = ?', [id], (err, registro) => {
    if (err) {
      return res.status(500).send('Error al consultar el registro');
    }
    res.render('edit', { registro });
  });
});

app.post('/edit/:id', (req, res) => {
  const id = req.params.id;
  const nombre = req.body.nombre;
  db.run('UPDATE registros SET nombre = ? WHERE id = ?', [nombre, id], err => {
    if (err) {
      return res.status(500).send('Error al actualizar el registro');
    }
    res.redirect('/');
  });
});

// Eliminar registro
app.get('/delete/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM registros WHERE id = ?', [id], err => {
    if (err) {
      return res.status(500).send('Error al eliminar el registro');
    }
    res.redirect('/');
  });
});

// Ver registro individual
app.get('/view/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM registros WHERE id = ?', [id], (err, registro) => {
    if (err) {
      return res.status(500).send('Error al consultar el registro');
    }
    res.render('view', { registro });
  });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
