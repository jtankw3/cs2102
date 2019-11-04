const sql_query = require('../sql');

// Postgre SQL Connection
const { Pool } = require('pg');
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
  //ssl: true
});

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
}


module.exports = initRouter;
