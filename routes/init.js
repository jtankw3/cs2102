const sql_query = require('../sql');

// Postgre SQL Connection
const { Pool } = require('pg');
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
  //ssl: true
});

// Global Variable
var sess = {};

function initRouter(app) {
	/* GET */
  app.get('/', function(req, res, next) {
		    res.render('index', { title: 'ModReg',});
	});

  /* All select operations can use this template */
  app.get('/test_select', function(req, res, next) {
  	pool.query(sql_query.query.find_user, (err, data) => {
  		res.render('test_select', { title: 'Select', data: data.rows });
  	});
  });

/* All insert operations can use this template */
app.get('/test_insert', function(req, res, next) {
	res.render('test_insert', { title: 'Insert' });
});

//  have to add test_insert to the ejs form
app.post('/test_insert', function(req, res, next) {
	// Retrieve Information
	var uid  = req.body.uid;
	var name    = req.body.name;
	var password = req.body.password;

  pool.query(sql_query.query.add_user, [uid, name, password], (err, data) => {
    if(err) {
      console.error("Error in adding user");
      res.redirect('/test_insert');
    } else {
      res.redirect('/test_select');
    }
  });
});

  // add all app.get app.post things here


// GET for login
app.get('/login', function(req, res, next) {
	if (sess["uid"] != null) {
		res.redirect('/about')
	} else {
		res.render('login', { title: 'Login' });
	}
});

// POST for login
app.post('/login', function(req, res, next) {
	var uid = req.body.uid;
	var password = req.body.password;

	pool.query('SELECT "password" FROM Users WHERE "uid" = $1', [uid], (err, result) => {
		if (err) {
			res.redirect('/relog')
		} else if (result.rows[0] == null) {
			res.redirect('/relog')
		} else {
			if (result.rows[0].password == [password]) {
				pool.query('SELECT "aid" FROM Administrator WHERE "aid" = $1', [uid], (err, result1) => {
					sess = req.body;
					sess["uid"] = uid;
					if (result1.rows[0] == null) {
						res.redirect('/about')
					} else {
						res.redirect('/index')
					}
				});
			} else {
				res.redirect('/relog')
			}
		}
	});
});

// Get for About
app.get('/about', function(req, res, next) {
 try {
	if (sess.uid != null) {
		res.render('about', { title: 'About' });
	}
 } 
 catch(err) {
	res.redirect('/login')
 }
});

// GET for Relog
app.get('/relog', function(req, res, next) {
	res.render('relog', { title: 'Login' });
});

// POST for Relog
app.post('/', function(req, res, next) {
	var uid = req.body.uid;
	var password = req.body.password;

	pool.query('SELECT "password" FROM Users WHERE "uid" = $1', [uid], (err, result) => {
		if (err) {
			res.redirect('/relog')
		} else if (result.rows[0] == null) {
			res.redirect('/relog')
		} else {
			if (result.rows[0].password == [password]) {
				pool.query('SELECT "aid" FROM Administrator WHERE "aid" = $1', [uid], (err, result1) => {
					sess = req.body;
					sess.uid = uid;
					if (result1.rows[0] == null) {
						res.redirect('/about')
					} else {
						res.redirect('/index')
					}
				});
			} else {
				res.redirect('/relog')
			}
		}
	});
});
}




module.exports = initRouter;
