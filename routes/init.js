const sql_query = require('../sql');

// Postgre SQL Connection
const { Pool } = require('pg');
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
  //ssl: true
});

// Global Variable
var sess = {};

/*
function initRouter(app) {
	// GET
  app.get('/', function(req, res, next) {
		    res.render('index', { title: 'ModReg',});
	});

  // All select operations can use this template
  app.get('/test_select', function(req, res, next) {
  	//pool.query(sql_query.query.find_user, (err, data) => {
	  pool.query("SELECT * FROM USERS", (err, data) => {
  		res.render('test_select', { title: 'Select', data: data.rows });
  	});
  });

// All insert operations can use this template
app.get('/test_insert', function(req, res, next) {
	res.render('test_insert', { title: 'Insert' });
});

//  have to add test_insert to the ejs form
app.post('/test_insert', function(req, res, next) {
	// Retrieve Information
	var uid  = req.body.uid;
	var name    = req.body.name;
	var password = req.body.password;

  //pool.query(sql_query.query.add_user, [uid, name, password], (err, data) => {
	pool.query("INSERT INTO users VALUES('" + uid + "','" + name + "','" + password + "')", (err, data) => {
    if(err) {
      console.error("Error in adding user");
      res.redirect('/test_insert');
    } else {
      res.redirect('/test_select');
    }
  });
});

*/
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
	if (sess.uid != null) {
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
				pool.query('SELECT "aid" FROM Administrators WHERE "aid" = $1', [uid], (err, result1) => {
					//sess = req.body;
					sess.uid = uid;
					if (result1.rows[0] == null) {
						res.redirect('/student_homepage')
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

//GET for Student
app.get('/student_homepage', function(req, res, next){
	res.render('student_homepage', { title: 'Student Homepage' });
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
app.post('/relog', function(req, res, next) {
	var uid = req.body.uid;
	var password = req.body.password;

	pool.query('SELECT "password" FROM Users WHERE "uid" = $1', [uid], (err, result) => {
		if (err) {
			res.redirect('/relog')
		} else if (result.rows[0] == null) {
			res.redirect('/relog')
		} else {
			if (result.rows[0].password == [password]) {
				pool.query('SELECT "aid" FROM Administrators WHERE "aid" = $1', [uid], (err, result1) => {
					sess = req.body;
					sess["uid"] = uid;
					if (result1.rows[0] == null) {
						res.redirect('/student_homepage')
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

// GET for course_registration
	app.get('/course_registration', function(req, res, next) {
		res.render('course_registration', { title: 'Course Registration' });
	});

// POST for course_registration
	app.post('/course_registration', function(req, res, next) {
		// Retrieve Information
		var cid  = req.body.cid;
		var sid =  sess["uid"];

		var insert_query = "INSERT INTO register VALUES('" + sid + "','" + cid + "')";
		pool.query(insert_query, (err, data) => {
			res.redirect('/student_homepage')
		});

		/*pool.query(sql_query.query.course_add, [sid, cid], (err, data) => {
			if(err){
				console.error("Error in adding user");
				res.redirect('/login')
			}
			else {
				res.redirect('/about')
			}
		});*/
	});

	// GET for View degree requirements
	var degree = 'Computer Science'
	var sql_query2 = "SELECT required_cid, type FROM requirements WHERE name = '" + degree + "'";

	app.get('/degree_requirements', function(req, res, next) {
		pool.query(sql_query2, (err, data) => {
			res.render('degree_requirements', { title: 'Degree Requirements', data: data.rows });
		});
	});

// GET for drop course
	app.get('/drop_course', function(req, res, next) {
		res.render('drop_course', { title: 'Drop Course' });
	});

// POST for drop course
	var sql_query1 = 'DELETE FROM accept WHERE cid =';
	app.post('/drop_course', function(req, res, next) {
		// Retrieve Information
		var cid  = req.body.cid;
		var sid = sess.uid;
		// var sid = 'A00000001D'

		// Construct Specific SQL Query
		var drop_query = sql_query1 + "'" + cid + "'" + "AND sid ='" + sid + "'";

		pool.query(drop_query, (err, data) => {
			res.redirect('/student_homepage')
		});
	});

	// GET for view course

	app.get('/view_course', function(req, res, next) {
		var sid = sess.uid;
		pool.query('SELECT A.cid, C.name FROM Accept A JOIN Courses C ON A.cid = C.cid WHERE A.sid =' + "'" + sid + "'", (err, data) => {
			res.render('view_course', { title: 'View Courses', data: data.rows });
		});
	});

}

module.exports = initRouter;
