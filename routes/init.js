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

			if (acad_year == null || acad_year != a_year || semester != sem) {
				res.redirect('/admin_allocate_insert_error');
			} else {
				pool.query(sql_query.query.calculate_priority,
						[cid, acad_year, semester, reg_round], (err, data) => {
					if(err) {
						console.error(err);
						res.render('admin_allocate_insert', {
							error: "An error occured, please proceed with manual allocation."});
					} else {
						for (var i=0; i<data.rows.length; i++) {
							var err_detected = false;
							pool.query(sql_query.query.add_allocated_student,
									[data.rows[i].sid, cid, acad_year, semester], (err, data2) => {
								if(err) {
									console.error(err);
									err_detected = true
									res.render('admin_allocate_insert', {
										error: "An error occured, please proceed with manual allocation."});
								}
							});
							if (err_detected) {
								break;
							}
						}
						setTimeout(() => { res.redirect('/admin_allocate_select?cid='
						+ cid +"&a_year=" + acad_year + "&semester=" + semester); }, 1000);
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
		var cid  = req.body.cid.toUpperCase();
		var c_name = req.body.c_name.toUpperCase();
		var c_quota = req.body.c_quota.toUpperCase();
		var credits = req.body.credits.toUpperCase();
		var date = req.body.exam_date.toUpperCase();
		var stime = req.body.s_time.toUpperCase();
		var etime = req.body.e_time.toUpperCase();
		var venue = req.body.venue.toUpperCase();
		var c_admin = sess.uid.toUpperCase();

		var finalexam_s_time = date + " " + stime;
		var finalexam_e_time = date + " " + etime;



		pool.query(sql_query.query.create_course, [cid, c_name, c_quota, credits, c_admin], (err, data) => {
			if (err) {
				console.error(err);
				res.render('course_creation', { title: 'Creating/Editing Course',
				error: 'An error occured, please check your inputs and try again.'});
			} else {
				if (date != '') {
					pool.query(sql_query.query.add_exam, [cid, finalexam_s_time, finalexam_e_time, venue], (err, data) => {
						if (err) {
							console.error(err);
							res.render('course_creation', { title: 'Creating/Editing Course',
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
			res.render('courses', { title: 'View Courses',
			data: data.rows });
		});
	});

	// GET for Courses
	app.get('/courses_error', function(req, res, next) {
		check_login(res, 'admin')
		pool.query(sql_query.query.view_course, (err, data) => {
			res.render('courses_error', { title: 'View Courses',
			data: data.rows });
		});
	});


	// POST for Courses deletion
	app.post('/delete_course', function(req, res, next) {
		pool.query(sql_query.query.delete_course,[req.query.cid],
			(err, data) => {
				if(err) {
					console.error(err)
					res.redirect('/courses_error')
				} else {
				 	res.redirect('/courses')
				}
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
				if (err) {
					console.error(err);
				}
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
				console.error(err);
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

	// GET for Degree view
	app.get('/degree', function(req, res, next) {
		check_login(res, 'admin')
		pool.query(sql_query.query.view_degree, (err, data) => {
			res.render('degree', { title: 'View Degrees', error:'',
			data: data.rows});
		});
	});
	// GET for Degree Creation
	app.get('/degree_creation', function(req, res, next) {
		check_login(res, 'admin')
		res.render('degree_creation', { title: 'Creating/Editing Degrees',
			error: ''});
	});

	// POST for Degree Creation
	app.post('/degree_creation', function(req, res, next) {
		// Retrieve Information
		var dname = req.body.dname.toUpperCase();
		var required_cid = req.body.required_cid.toUpperCase();
		var type = req.body.type.toUpperCase();
		var newdname = req.body.newdname.toUpperCase();
		console.log(dname, required_cid, type, newdname)

		if (newdname == '') {
			pool.query(sql_query.query.create_degree, [dname, required_cid, type], (err, data) => {
				if (err) {
					console.error(err);
					res.render('degree_creation', { title: 'Creating/Editing Degree',
						error: 'An error occured, please check your inputs and try again.'});
				} else {
					res.redirect('/degree')
				}
			});
		} else {
			pool.query(sql_query.query.update_degree, [dname, required_cid, type, newdname], (err, data) => {
				if (err) {
					console.error(err);
					res.render('degree_creation', { title: 'Creating/Editing Degree',
						error: 'An error occured, please check your inputs and try again.'});
				} else {
					res.redirect('/degree')
				}
			});
		}
	});

	// POST for degree deletion
	app.post('/delete_degree', function(req, res, next) {
		var dname  = req.query.dname.toUpperCase();

		pool.query(sql_query.query.delete_degree,
			[dname], (err, data) => {
				if (err) {
					console.error(err)
					pool.query(sql_query.query.view_degree, (err, data) => {
						res.render('degree', { title: 'View Degrees',
						error: 'Cannot delete degree with students still enrolled', data: data.rows});
					});
				} else {
						res.redirect('/degree');
				}
			});
	});

	// GET for degree_search
	app.get('/degree_search', function(req, res, next) {
		check_login(res, 'admin')
		res.render('degree_search', {message: '', error: '', course: '', data: []});
	});

	// POST for degree_search
	app.post('/degree_search', function(req, res, next) {
		var dname = req.body.dname.toUpperCase();
		pool.query(sql_query.query.search_degree, [dname],
			(err, data) => {
				if (err) {
					console.error(err)
					res.render('degree_search', { message: '',
						error: "An error occured, please check your input and try again.",
						name: '', data: [] });
				} else if (data.rows[0] == null) {
					res.render('degree_search', {
						message:'There are no students taking this degree', error: '',
						name: dname, data: data.rows });
				} else {

					res.render('degree_search', { message:'', error: '',
						name: dname, data: data.rows });
				}
			});
	});

	app.get('/degree_requirements', function(req, res, next) {
		check_login(res, 'student')
		var sid = sess.uid;
		pool.query(sql_query.query.get_degrees, [sid], (err, data) => {
			var degree1 = data.rows[0].dname1;
			var degree2 = data.rows[0].dname2;
			console.log(degree1, degree2)

			pool.query(sql_query.query.view_requirements, [degree1],
				(err, data1) => {
						pool.query(sql_query.query.view_requirements, [degree2],
							(err, data2) => {
							res.render('degree_requirements', {title: 'Degree Requirements',
							data1: data1.rows, data2: data2.rows, degree1: degree1,
							degree2: degree2});
						});
					});
				});
			});

	app.post('/delete_register', function(req, res, next) {
		var sid  = sess.uid;
		var cid  = req.query.cid.toUpperCase();

		pool.query(sql_query.query.delete_register,
			[cid, sid, acad_year, semester, reg_round], (err, data) => {
				res.redirect('/course_registration');
			});
	});

	// POST for drop course
	app.post('/drop_course', function(req, res, next) {
		// Retrieve Information
		var cid  = req.query.cid;
		var sid = sess.uid;

		pool.query(sql_query.query.drop_accept, [sid, cid], (err, result) => {
				res.redirect('/view_course')

		});
	});

	// GET for view course
	app.get('/view_course', function(req, res, next) {
		check_login(res, 'student')
		var sid = sess.uid;
		pool.query(sql_query.query.view_accept, [sid], (err, data) => {
		    pool.query(sql_query.query.view_taken, [sid], (err2, data2) => {
                res.render('view_course', {title: 'View Courses', data: data.rows, data2: data2.rows});
            });
		});
	});

	// GET for view course
	app.get('/student_prereq', function(req, res, next) {
		check_login(res, 'student')
		res.render('student_prereq', {message: '', error: '', course: '', data: []});
	});

	app.post('/student_prereq', function(req, res, next) {
		var cid = req.body.cid.toUpperCase();
		pool.query(sql_query.query.search_prereq, [cid],
			(err, data) => {
				if (err) {
					console.error(err)
					res.render('student_prereq', { message: '',
						error: "An error occured, please check your input and try again.",
					course: '', data: [] });
				} else if (data.rows[0] == null) {
					res.render('student_prereq', {
						message:'This course has no prerequisites', error: '',
						course: "for " + cid, data: data.rows });
					} else {

				res.render('student_prereq', { message:'', error: '',
					course: "for " + cid, data: data.rows });
				}
			});
	});

	app.get('/logout', function(req, res, next) {
			sess.uid = null
			sess.type = null
			res.redirect('/')
	});

	// Get change password(admin)
	app.get('/change_apw', function(req, res, next) {
		check_login(res, 'admin')
		res.render('change_apw', { title: 'Changing password',
			error: '' });
	});

	// Get change password(student)
	app.get('/change_spw', function(req, res, next) {
		check_login(res, 'student')
		res.render('change_spw', { title: 'Changing password',
			error: '' });
	});

	// Post change password(admin)
	app.post('/change_apw', function(req, res, next) {
		// Retrieve information

		var old_pw = req.body.old_pw;
		var new_pw = req.body.new_pw;
		var cnew_pw = req.body.cnew_pw;
		var uid = sess.uid;

		if (cnew_pw != new_pw || new_pw == '') {
			res.render('change_apw', { title: 'Changing password',
				error: 'Please make sure your passwords match. Please try again.'});
		} else {
			pool.query(sql_query.query.check_apw, [uid, old_pw], (err, data) => {
				if (data.rows[0] == null) {
					res.render('change_apw', { title: 'Changing password',
						error: 'Please make sure your passwords match. Please try again.'});
				} else {
					pool.query(sql_query.query.update_apw, [new_pw, sess.uid], (err, data) => {
						res.render('change_apw', { title: 'Changing password',
							error: 'Your password has been changed.'});
					});
				}
			});
		}
	});

	// Post change password(student)
	app.post('/change_spw', function(req, res, next) {
		// Retrieve information
		var old_pw = req.body.old_pw;
		var new_pw = req.body.new_pw;
		var cnew_pw = req.body.cnew_pw;
		var uid = sess.uid;

		if (cnew_pw != new_pw || new_pw == '') {
			res.render('change_spw', { title: 'Changing password',
				error: 'Please make sure your passwords match. Please try again.'});
		} else {
			pool.query(sql_query.query.check_spw, [uid, old_pw], (err, data) => {
				if (data.rows[0] == null) {
					res.render('change_spw', { title: 'Changing password',
						error: 'Please make sure your passwords match. Please try again.'});
				} else {
					pool.query(sql_query.query.update_spw, [new_pw, sess.uid], (err, data) => {
						res.render('change_spw', { title: 'Changing password',
							error: 'Your password has been changed.'});
					});
				}
			});
		}
	});

	// GET for registration period
	app.get('/regperiod', function(req, res, next) {
		check_login(res, 'admin')
		pool.query(sql_query.query.view_regperiod, (err, data) => {
			res.render('regperiod', { title: 'View Registration Period', error: '',
			data: data.rows });
		});
	});

	// POST for registration period
	app.post('/delete_regperiod', function(req, res, next) {
		var a_year = req.query.a_year
		var semester = req.query.semester
		var round = req.query.round;
		pool.query(sql_query.query.delete_regperiod,[a_year,semester,round],
			(err, data) => {
				if (err) {
					console.error(err)
					pool.query(sql_query.query.view_regperiod, (err, data) => {
						res.render('regperiod', { title: 'View Registration Period',
						error: 'Cannot delete registration period with activity.', data: data.rows });
					});
				} else {
				res.redirect('/regperiod')
				}
			});
	});


	// Get add registration period
	app.get('/add_regperiod', function(req, res, next) {
		check_login(res, 'admin')
		res.render('add_regperiod', { title: 'Adding new registration period',
			error: '' });
	});

	// Post add registration period
	app.post('/add_regperiod', function(req, res, next) {
		check_login(res, 'admin')
		// Retrieve Information
		var a_year  = req.body.a_year;
		var semester = req.body.semester;
		var round = req.body.round;
		var s_time = req.body.s_time;
		var e_time = req.body.e_time;

		pool.query(sql_query.query.create_regperiod, [a_year, semester, round, s_time, e_time], (err, data) => {
			if (err) {
				console.error(err);
				res.render('add_regperiod', { title: 'Adding new registration period',
					error: 'An error occured, please check your inputs and try again.'});
			} else {
				res.redirect('/regperiod')
			}
		});
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
}
module.exports = initRouter;
