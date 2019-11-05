const sql_query = require('../sql');

// Postgre SQL Connection
const { Pool } = require('pg');
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
  //ssl: true
});

// Global Variables
var sess = {};
var acad_year;
var semester;
var reg_round;

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

	// POST for login
app.post('/login', function(req, res, next) {
  var uid = req.body.uid;
  var password = req.body.password;

  pool.query('SELECT "password" FROM Administrators WHERE "aid" = $1', [uid], (err, result) => {
    if (result.rows[0] == null) {
      pool.query('SELECT "password" FROM EnrolledStudents WHERE "sid" = $1', [uid], (err, result1) => {
        if (result1.rows[0] == null) {
          res.redirect('/relog')
        } else if (result1.rows[0].password == [password]) {
          sess.uid = uid;
          sess.type = "student"
          res.redirect('/student_homepage')
        } else {
          res.redirect('/relog')
        }
      });
    } else {
      if (result.rows[0].password == [password]) {
        sess.uid = uid;
        sess.type = "admin"
        res.redirect('/admin_homepage')
      } else {
        res.redirect('/relog')
      }
    }
  });
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
			res.render('/about')
		} else {
			res.render('login', { title: 'Login' });
		}
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

	pool.query('SELECT "password" FROM Administrators WHERE "aid" = $1', [uid], (err, result) => {
		if (result.rows[0] == null) {
			pool.query('SELECT "password" FROM EnrolledStudents WHERE "sid" = $1', [uid], (err, result1) => {
				if (result1.rows[0] == null) {
					res.redirect('/relog')
				} else if (result1.rows[0].password == [password]) {
					sess.uid = uid;
					sess.type = "student"
					res.redirect('/student_homepage')
				} else {
					res.redirect('/relog')
				}
			});
		} else {
			if (result.rows[0].password == [password]) {
				sess.uid = uid;
				sess.type = "admin"
				res.redirect('/admin_homepage')
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

	app.post('/delete_admin', function(req, res, next) {
		pool.query(sql_query.query.delete_admin,[req.query.aid],
			(err, data) => {
				res.redirect('/admin')
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

// GET for Admin
app.get('/admin_homepage', function(req, res, next) {
	res.render('admin_homepage', { title: 'Admin Homepage' });
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
						res.redirect('/admin_homepage')
					}
				});
			} else {
				res.redirect('/relog')
			}
		}
	});
});

// GET for Course Creation
	app.get('/course_creation', function(req, res, next) {
		res.render('course_creation', { title: 'Creating/Editing Course' });
	});

// POST for Course Creation
	app.post('/course_creation', function(req, res, next) {
		// Retrieve Information
		var cid  = req.body.cid;
		var quota = req.body.quota;
		var name    = req.body.name;
		var credit = req.body.credit;
		var c_admin = req.body.c_admin;

		pool.query(sql_query.query.create_course, [cid, quota, name, credit, c_admin], (err, data) => {
			res.redirect('/courses')
		});
	});

// GET for Courses
	app.get('/courses', function(req, res, next) {
		pool.query(sql_query.query.view_course, (err, data) => {
			res.render('courses', { title: 'View Courses', data: data.rows });
		});
	});
	app.get('/courses/delete/:cid', function(req, res, next) {
		res.render('courses', { title: 'View Courses', data: data.rows });
	});

	app.post('/courses/delete/<%= data[i].cid%>', function(req,res,next) {
		pool.query(sql_query.query.delete_course, [req.params.cid], (err,data) => {
			res.render('courses', {title: 'View Courses', data: data.rows});
		});
	});

// GET for Prereq Creation
	app.get('/prereq_creation', function(req, res, next) {
		res.render('prereq_creation', { title: 'Creating/Editing Prerequisites' });
	});

// POST for Prereq Creation
	app.post('/prereq_creation', function(req, res, next) {
		// Retrieve Information
		var required_cid  = req.body.required_cid;
		var requiring_cid  = req.body.requiring_cid;
		var setter = req.body.setter;

		pool.query(sql_query.query.create_prereq, [required_cid, requiring_cid, setter], (err, data) => {
			res.redirect('/prereq')
		});
	});

// GET for Prereq
	app.get('/prereq', function(req, res, next) {
		pool.query(sql_query.query.view_prereq, (err, data) => {
			res.render('prereq', { title: 'View Prerequisites', data: data.rows });
		});
	});

// GET for Student Creation
	app.get('/student_creation', function(req, res, next) {
		res.render('student_creation', { title: 'Creating/Editing Students' });
	});

	app.post('/student_creation', function(req, res, next) {
		// Retrieve Information
		var sid  = req.body.sid;
		var e_year  = req.body.e_year;
		var dname1 = req.body.dname1;
		var dname2 = req.body.dname2;

		pool.query(sql_query.query.create_student, [sid, e_year, dname1, dname2], (err, data) => {
			res.redirect('/student')
		});
	});

// GET for Student
	app.get('/student', function(req, res, next) {
		pool.query(sql_query.query.view_student, (err, data) => {
			res.render('student', { title: 'View Students', data: data.rows });
		});
	});

// GET for Admin Creation
	app.get('/admin_creation', function(req, res, next) {
		res.render('admin_creation', { title: 'Creating/Editing Administrators' });
	});

// POST for Admin Creation
	app.post('/admin_creation', function(req, res, next) {
		// Retrieve Information
		var aid  = req.body.aid;

		pool.query(sql_query.query.create_admin, [aid], (err, data) => {
			res.redirect('/admin')
		});
	});

// GET for Admin
	app.get('/admin', function(req, res, next) {
		pool.query(sql_query.query.view_admin, (err, data) => {
			res.render('admin', { title: 'View Administrators', data: data.rows });
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

	app.get('/logout', function(req, res, next) {
			sess["uid"] = null
			res.render('login', { title: 'Login' });
	});
};



module.exports = initRouter;
