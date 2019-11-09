CS2102 Webapp

-- Course Registration System -- 
Our web application is a course registration system that facilitates the registration and allocation of courses 
during a Universities’ registration period. 

Make sure Node and Postgres are already installed.

-- Steps --

Installing relevant modules:
1) Clone this repo: git clone https://github.com/jtankw3/cs2102
2) Install dependencies using npm javascript packet manager: npm install

Setting up the database:
1) Run the testdata.sql file on PostgreSQL: \i <path>/testdata.sql
	<path> is the path to the testdata.sql script
2) create a .env file with the connection string:
	e.g. DATABASE URL=postgres://<username>:<password>@host address:<port>/<database name>
	replace <username>, <password>, <port> and <databse name> accorfing to your PostgreSQL configuration

Running the web app:
3) Start node server with: node bin\www
4) View webpage at http://localhost:3000