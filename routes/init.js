const sql_query = require('../sql');

// Postgre SQL Connection
const { Pool } = require('pg');
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
  //ssl: true
});

// Global Variables
var sess = {};
var acad_year = 2019;
var semester = 1;
var reg_round = 3;

function initRouter(app) {
	/* GET */
  app.get('/', function(req, res, next) {
			pool.query(sql_query.query.get_period, (err, data) => {
				if (data.rows[0] == null) {
					res.redirect('/closed');
				} else {
					acad_year = data.rows[0].a_year;
					semester =  data.rows[0].semester;
					reg_round = data.rows[0].a_year;
				}
		});
		  res.render('index', { title: 'RegMod', a_year: acad_year,
			semester: semester, round: reg_round});
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

	app.get('/admin_allocate_search', function(req, res, next) {
			res.render('admin_allocate_search', { title: 'Allocated Students' });
	});


	app.post('/admin_allocate_search', function(req, res, next) {
		pool.query(sql_query.query.allocated_students,[req.body.cid, acad_year,semester],
			(err, data) => {
				res.render('admin_allocate_select', { title: req.body.cid,
					data: data.rows });
			});
	});

	app.get('/admin_allocate_select', function(req, res, next) {
		pool.query(sql_query.query.allocated_students,[req.query.cid, acad_year,semester],
			(err, data) => {
				res.render('admin_allocate_select', { title: req.query.cid,
					data: data.rows });
			});
	});

	app.post('/delete_allocate', function(req, res, next) {
		pool.query(sql_query.query.delete_allocated_students,[req.query.cid,
			acad_year,semester],
			(err, data) => {
				res.redirect('/admin_allocate_select')
			});
	});

	app.get('/admin_allocate_insert', function(req, res, next) {
		res.render('admin_allocate_insert');
	});

	app.post('/admin_allocate_insert', function(req, res, next) {
		var sid  = req.body.sid;
		var cid    = req.body.cid;

	  pool.query(sql_query.query.add_user, [uid, name, password], (err, data) => {
	    if(err) {
	      console.error("Error in adding user");
	      res.redirect('/admin_allocate_insert');
	    } else {
	      res.redirect('/admin_allocate_select?cid=' + cid);
			}
		});
	});
};




module.exports = initRouter;
