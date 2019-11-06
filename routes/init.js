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
var degree1;
var degree2;

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
			getCurrentPeriod(req, res, (req, res) => {
				if (acad_year == null) {
					res.render('login', {title: 'RegMod Login', message: 'There is no ongoing round.',
					subtext: 'Do not share your password with anyone!', error: ''})
				} else {
					res.render('login', {title: 'RegMod Login', subtext: 'Do not share your password with anyone!', error: '',
						message: "Currently ongoing: AY" + acad_year + " Sem " + semester + " Round " + reg_round });
				}
			});
		}
	});

	// Landing Page Post
	app.post('/', function(req, res, next) {
		var uid = req.body.uid.toUpperCase();
		var password = req.body.password;
		pool.query('SELECT "password" FROM Administrators WHERE "aid" = $1', [uid], (err, result) => {
			if (result.rows[0] == null) {
				pool.query('SELECT "password" FROM EnrolledStudents WHERE "sid" = $1', [uid], (err, result1) => {
					if (result1.rows[0] == null) {
						res.render('login', { title: 'RegMod Login', subtext: '', error: 'UID does not exist.', message:''})
					} else if (result1.rows[0].password == [password]) {
						sess.uid = uid;
						sess.type = "student"
						res.redirect('/student_homepage')
					} else {
						res.render('login', { title: 'RegMod Login', subtext: '', error: 'Wrong password.', message: ''})
					}
				});
			} else {
				if (result.rows[0].password == [password]) {
					sess.uid = uid;
					sess.type = "admin"
					res.redirect('/admin_homepage')
				} else {
					res.render('login', { title: 'RegMod Login', subtext: '', message:'', error: 'Wrong password'})
				}
			}
		});
	});

	// add all app.get app.post things here

	app.get('/admin_allocate_search', function(req, res, next) {
		check_login(res, 'admin');
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
		check_login(res, 'admin')
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

	//POST for admin deletion
	app.post('/delete_admin', function(req, res, next) {
		var aid = req.query.aid;
		pool.query(sql_query.query.delete_admins, [aid], (err, data) => {
				if (err) {
					console.error(err)
					res.redirect('/admin_error')
				} else{
					res.redirect('/admin')
				}
			});
	});

	app.get('/admin_allocate_insert', function(req, res, next) {
		check_login(res, 'admin')
		res.render('admin_allocate_insert', {error: ''});
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
					error: "An error occured, please check your input and try again."});
			} else {
	    res.redirect('/admin_allocate_select?cid=' + cid
		+"&a_year=" + a_year + "&semester=" + sem);
			}
		});
	});

	app.post('/admin_allocate_auto', function(req, res, next) {
		getCurrentPeriod(req, res, (req, res) => {
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
						for (var i=0; i<data.rows.length; i++) {
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
	});

	// GET for Admin
	app.get('/admin_allocate_insert_error', function(req, res, next) {
		check_login(res, 'admin')
		res.render('admin_allocate_insert_error');
	});

	// GET for Admin
	app.get('/admin_homepage', function(req, res, next) {
		check_login(res, 'admin')
		res.render('admin_homepage', { title: 'Admin Homepage' });
	});

	//GET for Student
	app.get('/student_homepage', function(req, res, next){
		check_login(res, 'student')
		var sid =  sess["uid"];
		var sql_query1 = "SELECT dname1 FROM enrolledstudents WHERE sid='" + sid + "'";
		var sql_query2 = "SELECT dname2 FROM enrolledstudents WHERE sid='" + sid + "'";
		pool.query(sql_query1, (err, data1) => {
			pool.query(sql_query2, (err, data2) => {
				degree1 = data1.rows[0].dname1;
				degree2 = data2.rows[0].dname2;
				console.log(degree1);
				console.log(degree2);
				res.render('student_homepage', { title: 'Student Homepage' });
			});
		});
	});

	// Get for Success
	app.get('/success', function(req, res, next) {
		res.render('success', { title: 'About' });
	});


	// GET for Course Creation
	app.get('/course_creation', function(req, res, next) {
		check_login(res, 'admin')
		res.render('course_creation', { title: 'Creating/Editing Course',
		error: '' });
	});

	// POST for Course Creation
	app.post('/course_creation', function(req, res, next) {
		check_login(res, 'admin')
		// Retrieve Information
		var cid  = req.body.cid;
		var c_name = req.body.c_name;
		var c_quota = req.body.c_quota;
		var credits = req.body.credits;
		var date = req.body.exam_date;
		var stime = req.body.s_time;
		var etime = req.body.e_time;
		var venue = req.body.venue;
		var c_admin = sess.uid;

		var finalexam_s_time = date + " " + stime;
		var finalexam_e_time = date + " " + etime;



		pool.query(sql_query.query.create_course, [cid, c_name, c_quota, credits, c_admin], (err, data) => {
			if (err) {
				console.error(err);
				res.render('course_creation', { title: 'Creating/Editing Administrators',
				error: 'An error occured, please check your inputs and try again.'});
			} else {
				if (date != '') {
					pool.query(sql_query.query.add_exam, [cid, finalexam_s_time, finalexam_e_time, venue], (err, data) => {
						if (err) {
							console.error(err);
							res.render('course_creation', { title: 'Creating/Editing Administrators',
								error: 'An error occured, please check your inputs and try again.'});
						} else {
							res.redirect('/courses')
						}
					});
				} else {
					res.redirect('/courses')
				}
			}
		});
	});

	// GET for Courses
	app.get('/courses', function(req, res, next) {
		check_login(res, 'admin')
		pool.query(sql_query.query.view_course, (err, data) => {
			res.render('courses', { title: 'View Courses', data: data.rows });
		});
	});

	// POST for Courses deletion
	app.post('/delete_course', function(req, res, next) {
		pool.query(sql_query.query.delete_course,[req.query.cid],
			(err, data) => {
				res.redirect('/courses')
			});
	});

	// GET for Prereq Creation
	app.get('/prereq_creation', function(req, res, next) {
		check_login(res, 'admin')
		res.render('prereq_creation', { title: 'Creating/Editing Prerequisites',
	error: '' });
	});

	// POST for Prereq Creation
	app.post('/prereq_creation', function(req, res, next) {
		// Retrieve Information
		var required_cid  = req.body.required_cid.toUpperCase();
		var requiring_cid  = req.body.requiring_cid.toUpperCase();
		var setter = sess['uid'];
		console.log(sess, setter)

		pool.query(sql_query.query.create_prereq,
			[required_cid, requiring_cid, setter], (err, data) => {
				if (err) {
					console.error(err);
					res.render('prereq_creation', { title: 'Creating/Editing Prerequisites',
				error: 'An error occured, please check your inputs and try again.' });
			} else {
				res.redirect('/prereq')
			}
		});
	});

	// GET for Prereq
	app.get('/prereq', function(req, res, next) {
		check_login(res, 'admin')
		pool.query(sql_query.query.view_prereq, (err, data) => {
			res.render('prereq', { title: 'View Prerequisites', data: data.rows });
		});
	});

	// POST for Prereq deletion
	app.post('/delete_prereq', function(req, res, next) {
		var required_cid = req.query.required_cid.toUpperCase();
		var requiring_cid = req.query.requiring_cid.toUpperCase();
		pool.query(sql_query.query.delete_prereqs,[required_cid,requiring_cid],
			(err, data) => {
				res.redirect('/prereq')
			});
	});

	// GET for Student Creation
	app.get('/student_creation', function(req, res, next) {
		check_login(res, 'admin')
		res.render('student_creation', { title: 'Creating/Editing Students',
		error: '' });
	});

	app.post('/student_creation', function(req, res, next) {
		// Retrieve Information
		var sid  = req.body.sid.toUpperCase();
		var sname = req.body.sname.toUpperCase();
		var e_year  = req.body.e_year.toUpperCase();
		var dname1 = req.body.dname1.toUpperCase();
		var dname2 = req.body.dname2.toUpperCase();

		if (dname2 == '') {
			pool.query(sql_query.query.create_student, [sid, sname, e_year, dname1, null], (err, data) => {
				if(err) {
					console.error(err);
					res.render('student_creation', { title: 'Creating/Editing Students',
					error: 'An error occured, please check your inputs and try again.' });
				} else {
				res.redirect('/student')
				}
			});
		} else {
			pool.query(sql_query.query.create_student, [sid, sname, e_year, dname1, dname2], (err, data) => {
				if(err) {
					console.error(err);
					res.render('student_creation', { title: 'Creating/Editing Students',
					error: 'An error occured, please check your inputs and try again.' });
				} else {
					res.redirect('/student')
				}
			});
		}
	});

	// GET for Student
	app.get('/student', function(req, res, next) {
		check_login(res, 'admin')
		pool.query(sql_query.query.view_student, (err, data) => {
			res.render('student', { title: 'View Students', data: data.rows });
		});
	});

	// POST for Student deletion
	app.post('/drop_student', function(req, res, next) {
		check_login(res, 'admin')
		var sid = req.query.sid.toUpperCase();
		pool.query(sql_query.query.drop_students,[sid],
			(err, data) => {
				res.redirect('/student')
			});
	});

	// GET for Admin Creation
	app.get('/admin_creation', function(req, res, next) {
		check_login(res, 'admin')
		res.render('admin_creation', { title: 'Creating/Editing Administrators',
	 	error: ''});
	});

	// POST for Admin Creation
	app.post('/admin_creation', function(req, res, next) {
		// Retrieve Information
		var aid  = req.body.aid.toUpperCase();
		var name = req.body.name.toUpperCase();

		pool.query(sql_query.query.create_admin, [aid,name], (err, data) => {
			if (err) {
				console.err(err);
				res.render('admin_creation', { title: 'Creating/Editing Administrators',
				error: 'An error occured, please check your inputs and try again.'});
			} else {
				res.redirect('/admin')
			}
		});
	});

	// GET for Admin view
	app.get('/admin', function(req, res, next) {
		check_login(res, 'admin')
		pool.query(sql_query.query.view_admin, (err, data) => {
			res.render('admin', { title: 'View Administrators', data: data.rows});
		});
	});

	app.get('/admin_error', function(req, res, next) {
		check_login(res, 'admin')
		pool.query(sql_query.query.view_admin, (err, data) => {
			res.render('admin_error', { title: 'View Administrators', data: data.rows});
		});
	});

	// GET for course_registration
	app.get('/course_registration', function(req, res, next) {
		check_login(res, 'student')
		getCurrentPeriod(req, res, (req, res) => {
			if (acad_year == null) {
				res.render('course_registration_closed', {title: 'View Courses',
				data: []});
			} else {
				var sid = sess.uid;
				pool.query(sql_query.query.view_register,
					[acad_year, semester, reg_round, sid], (err, data) => {
						res.render('course_registration', {title: 'View Courses', error:'',
						data: data.rows});
				});
			}
		});
	});

	app.get('/course_registration_insert', function(req, res, next) {
		res.render('course_registration_insert', {title: 'View Courses', error:'',
		});
	});

	// POST for course_registration
	app.post('/course_registration_insert', function(req, res, next) {
		// Retrieve Information
		var cid  = req.body.cid.toUpperCase();
		var sid =  sess.uid;
		console.log(cid, sid)
		pool.query(sql_query.query.create_register,
			[acad_year, semester, reg_round, sid, cid], (err, data) => {
				var error_msg = '';
				if (err) {
					console.error(err);
					if (err.message == "Prerequisite not fulfilled") {
						error_msg = "You have not fulfilled the prerequisites for this course."
					} else if (err.message == "Course selected have clashing examinations")  {
						error_msg = "The timing of the examination for this course clashes "
						+ " with another you have registered for or have been allocated."
					} else if (err.message == "Course Limit Exceeded") {
						error_msg = "You have exceeded the maximum number of courses you can take this semester."
					} else if (err.message == "Already Allocated Course") {
						error_msg = "You have already been allocated this course."
					} else {
						error_msg = "Invalid input. If you entered a valid course code, you "
						+ "may already have registered for it"
					}
				res.render('course_registration_insert', {title: "Course Registration",
				 error: error_msg,});
			 } else {
			 		res.redirect('/course_registration');
				}
		});
	});

	app.get('/degree_requirements', function(req, res, next) {
		check_login(res, 'student')
		var degree_1 = degree1;
		var degree_2 = degree2;
		console.log(degree1);
		var sql_query1 = "SELECT required_cid, type FROM requirements WHERE name = '" + degree_1 + "'";
		var sql_query2 = "SELECT required_cid, type FROM requirements WHERE name = '" + degree_2 + "'";
		pool.query(sql_query1, (err, data1) => {
			pool.query(sql_query2, (err, data2) => {
				res.render('degree_requirements', {title: 'Degree Requirements', data1: data1.rows, data2: data2.rows});
			});
		});
	});

	app.post('/delete_register', function(req, res, next) {
		var sid  = req.query.sid.toUpperCase();
		var cid  = req.query.cid.toUpperCase();

		pool.query(sql_query.query.delete_register,
			[cid, sid, acad_year, semester, reg_round], (err, data) => {
				res.redirect('/course_registration');
			});
	});

	// GET for drop course
	app.get('/drop_course', function(req, res, next) {
		check_login(res, 'student')
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
		check_login(res, 'student')
		var sid = sess.uid;
		pool.query('SELECT A.cid, C.name FROM Accept A JOIN Courses C ON A.cid = C.cid WHERE A.sid =' + "'" + sid + "'", (err, data) => {
		    pool.query('SELECT A.cid, C.name FROM Taken A JOIN Courses C ON A.cid = C.cid WHERE A.sid =' + "'" + sid + "'", (err2, data2) => {
                res.render('view_course', {title: 'View Courses', data: data.rows, data2: data2.rows});
            });
		});
	});

	app.get('/logout', function(req, res, next) {
			sess.uid = null
			sess.type = null
			//res.render('', { title: 'Login' , subtext: 'Do not share your password with anyone!', error:''});
			res.redirect('/')
	});
}

function getCurrentPeriod(req, res, callback) {
	pool.query(sql_query.query.get_period, (err, data) => {
		if(data.rows[0] != null) {
			acad_year = data.rows[0].a_year;
			semester = data.rows[0].semester;
			reg_round = data.rows[0].round;
		}
		callback(req, res)
	});
}

function check_login(res, type) {
	if (sess.uid == null || sess.type != type) {
		res.redirect('/')
	}
	// }
}
module.exports = initRouter;
