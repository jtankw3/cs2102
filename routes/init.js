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
	// Landing Page Get
	app.get('/', function(req, res, next) {
		if (sess.uid != null) {
			if (sess.type == "admin") {
				res.redirect('/admin_homepage')
			} else {
				res.redirect('/student_homepage')
			}
		} else {
				getCurrentPeriod(app);
				if (acad_year == null) {
					res.render('login', {title: 'RegMod', message: 'There is no ongoing round.',
					subtext: 'Do not share your password with anyone!', error: ''})
				} else {
					res.render('login', {title: 'RegMod Login', subtext: 'Do not share your password with anyone!', error: '',
						message: "Currently ongoing: AY" + acad_year + " Sem " + semester + " Round " + reg_round });
				}
			}
		});

	// Landing Page Post
	app.post('/', function(req, res, next) {
		var uid = req.body.uid;
		var password = req.body.password;
		pool.query('SELECT "password" FROM Administrators WHERE "aid" = $1', [uid], (err, result) => {
			if (result.rows[0] == null) {
				pool.query('SELECT "password" FROM EnrolledStudents WHERE "sid" = $1', [uid], (err, result1) => {
					if (result1.rows[0] == null) {
						res.render('', { title: 'Login', subtext: '', error: 'UID does not exist.'})
					} else if (result1.rows[0].password == [password]) {
						sess.uid = uid;
						sess.type = "student"
						res.redirect('/student_homepage')
					} else {
						res.render('login', { title: 'Login', subtext: '', error: 'Wrong password.'})
					}
				});
			} else {
				if (result.rows[0].password == [password]) {
					sess.uid = uid;
					sess.type = "admin"
					res.redirect('/admin_homepage')
				} else {
					res.render('', { title: 'Login', subtext: '', error: 'Wrong password'})
				}
			}
		});
	});

	// add all app.get app.post things here

	app.get('/admin_allocate_search', function(req, res, next) {
			res.render('admin_allocate_search', { title: 'Allocated Students',
		subtext: "" });
	});


	app.post('/admin_allocate_search', function(req, res, next) {
		var cid = req.body.cid.toUpperCase();
		var a_year = req.body.a_year.toUpperCase();
		var semester = req.body.semester.toUpperCase();
		pool.query(sql_query.query.allocated_students, [cid, a_year, semester],
			(err, data) => {
				if (err) {
					res.render('admin_allocate_search', { title: 'Allocated Students',
					subtext: "An error occured, please check your input and try again." });
				} else {
				res.render('admin_allocate_select', { course: cid,
					a_year: a_year, semester: semester, data: data.rows });
				}
			});
	});

	app.get('/admin_allocate_select', function(req, res, next) {
		pool.query(sql_query.query.allocated_students,[req.query.cid,
			req.query.a_year,req.query.semester],
			(err, data) => {
				res.render('admin_allocate_select', { course: req.query.cid,
					a_year: req.query.a_year, semester: req.query.semester,
					data: data.rows });
			});
	});

	app.post('/delete_allocate', function(req, res, next) {
		var a_year  = req.query.a_year.toUpperCase();
		var sem  = req.query.semester.toUpperCase();
		var sid  = req.query.sid.toUpperCase();
		var cid  = req.query.cid.toUpperCase();

		pool.query(sql_query.query.delete_allocated_student,[cid, sid],
			(err, data) => {
				res.redirect('/admin_allocate_select?cid=' + cid
			+"&a_year=" + a_year + "&semester=" + sem);
			});
	});

	app.post('/delete_admin', function(req, res, next) {
		pool.query(sql_query.query.delete_admin,[req.query.aid],
			(err, data) => {
				res.redirect('/admin')
			});
	});

	app.get('/admin_allocate_insert', function(req, res, next) {
		res.render('admin_allocate_insert', {subtext: ""});
	});

	app.post('/admin_allocate_insert', function(req, res, next) {
		var a_year  = req.body.a_year.toUpperCase();
		var sem  = req.body.semester.toUpperCase();
		var sid  = req.body.sid.toUpperCase();
		var cid  = req.body.cid.toUpperCase();

	  pool.query(sql_query.query.add_allocated_student,
				[sid, cid, a_year, sem], (err, data) => {
	    if(err) {
	      console.error(err['detail']);
				res.render('admin_allocate_insert', {
					subtext: "An error occured, please check your input and try again."});
			} else {
	    res.redirect('/admin_allocate_select?cid=' + cid
		+"&a_year=" + a_year + "&semester=" + sem);
			}
		});
	});

	app.post('/admin_allocate_auto', function(req, res, next) {
		getCurrentPeriod(app);
			var cid = req.query.cid.toUpperCase();
			var a_year = req.query.a_year.toUpperCase();
			var sem = req.query.semester.toUpperCase();

			console.log(cid, a_year, sem);
			console.log(acad_year, semester)

		if (acad_year == null || acad_year != a_year || semester != sem) {
			console.log("not equal")
			res.redirect('/admin_allocate_insert_error');
		} else {
		  pool.query(sql_query.query.calculate_priority,
					[cid, acad_year, semester, reg_round], (err, data) => {
		    if(err) {
		      console.error(err);
					res.render('admin_allocate_insert', {
						subtext: "An error occured, please proceed with manual allocation."});
				} else {
					console.log(cid, acad_year, semester, reg_round, sql_query.query.calculate_priority);
					console.log(data)
					console.log(data.rows)
					for (var i=0; i<data.rows.length; i++) {
						console.log(data.rows[i].sid)
						var err_detected = false;
						pool.query(sql_query.query.add_allocated_student,
								[data.rows[i].sid, cid, acad_year, semester], (err, data2) => {
					    if(err) {
					      console.error(err);
								err_detected = true
								res.render('admin_allocate_insert', {
									subtext: "An error occured, please proceed with manual allocation."});
							}
						});
						if (err_detected) {
							break;
						}
					}
					res.redirect('/admin_allocate_select?cid=' + cid +"&a_year="
						+ acad_year + "&semester=" + semester);
				}
			});
		}
	});

	// GET for Admin
	app.get('/admin_allocate_insert_error', function(req, res, next) {
		res.render('admin_allocate_insert_error');
	});

	// GET for Admin
	app.get('/admin_homepage', function(req, res, next) {
		res.render('admin_homepage', { title: 'Admin Homepage' });
	});

	//GET for Student
	app.get('/student_homepage', function(req, res, next){
		res.render('student_homepage', { title: 'Student Homepage' });
	});

	// Get for Success
	app.get('/success', function(req, res, next) {
		res.render('success', { title: 'About' });
	});


	// GET for Course Creation
	app.get('/course_creation', function(req, res, next) {
		res.render('course_creation', { title: 'Creating/Editing Course' });
	});

	// POST for Course Creation
	app.post('/course_creation', function(req, res, next) {
		// Retrieve Information
		var cid  = req.body.cid;
		var c_name = req.body.c_name;
		var c_quota = req.body.c_quota;
		var credits = req.body.credits;
		var c_admin = req.body.c_admin;

		pool.query(sql_query.query.create_course, [cid, c_name, c_quota, credits, c_admin], (err, data) => {
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
		var sname = req.body.sname;
		var e_year  = req.body.e_year;
		var dname1 = req.body.dname1;
		var dname2 = req.body.dname2;

		if (dname2 == '') {
			pool.query(sql_query.query.create_student, [sid, sname, e_year, dname1, null], (err, data) => {
				res.redirect('/student')
			});
		} else {
			pool.query(sql_query.query.create_student, [sid, sname, e_year, dname1, dname2], (err, data) => {
				res.redirect('/student')
			});
		}
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
		var aname = req.body.aname;

		pool.query(sql_query.query.create_admin, [aid,aname], (err, data) => {
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
		res.render('course_registration', { title: 'Course Registration' , error: ''});
	});

	// POST for course_registration
	app.post('/course_registration', function(req, res, next) {
		// Retrieve Information
		var cid  = req.body.cid;
		var sid =  sess["uid"];
		var a_year = "2019";
		var semester = "1";
		var round = "2";

		var insert_query = "INSERT INTO register VALUES(" + a_year + "," + semester + "," + round + ",'" + sid + "','" + cid + "')";
		pool.query(insert_query, (err, data) => {
			//res.redirect('/student_homepage')
			if(err) {
				var error = err;
				console.log(error);
				res.render('course_registration', { title: 'Course Registration' , error: 'You either have not fulfilled the prerequisites for this module or you have exceeded the maximum modules or the final exams clash. We do not know which :)'});
			} else {
				res.redirect('/about', );
			}
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
	var sql_query1 = 'DELETE FROM accept WHERE sid =';
	app.post('/drop_course', function(req, res, next) {
		// Retrieve Information
		var cid  = req.body.cid;
		var sid = sess.uid;

		// Construct Specific SQL Query
		var drop_query = sql_query1 + "'" + sid + "'" + "AND cid ='" + cid + "'";

		pool.query("SELECT * FROM Accept WHERE sid = '" + sid +"' AND cid = '" + cid + "'", (err, result) => {
			if (err) {
				res.redirect('/drop_course')
			} else if (result.rows[0] == null) {
				res.redirect('/drop_course')
				//res.render('login', { title: 'Login', subtext: '', error: 'UID does not exist.'})
			} else {
				pool.query(drop_query, (err, data) => {
					if(err) {
						res.redirect('/drop_course')
					}
					else {
						res.redirect('/success', );
					}
				});
			}
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
			sess.uid = null
			sess.type = null
			//res.render('', { title: 'Login' , subtext: 'Do not share your password with anyone!', error:''});
			res.redirect('/')
	});

};
function getCurrentPeriod(app) {
	pool.query(sql_query.query.get_period, (err, data) => {
		if(data.rows[0] != null) {
			acad_year = data.rows[0].a_year;
			semester = data.rows[0].semester;
			reg_round = data.rows[0].round;
		}
	});
}
module.exports = initRouter;
