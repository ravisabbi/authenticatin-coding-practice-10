const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB ERROR : ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//CONVERT STATES DB OBJECT TO RESPONSE OBJECT

const convertStateDbObjToResponseObj = (DbObj) => {
  return {
    stateId: DbObj.state_id,
    stateName: DbObj.state_name,
    population: DbObj.population,
  };
};

// CONVERT DISTRICTS DB OBJECT TO RESPONSE OBJECT

const convertDistrictDbObjToResponseObj = (DbObj) => {
  return {
    districtId: DbObj.district_id,
    districtName: DbObj.district_name,
    stateId: DbObj.state_id,
    cases: DbObj.cases,
    cured: DbObj.cured,
    active: DbObj.active,
    deaths: DbObj.deaths,
  };
};

//MIDDLEWARE FUNCTION
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//LOGIN USER API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// GET STATES API
app.get("/states", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state;`;
  const allStates = await db.all(getStatesQuery);
  const responseStatesArray = allStates.map((state) =>
    convertStateDbObjToResponseObj(state)
  );
  response.send(responseStatesArray);
});

// GET STATE API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const DbState = await db.get(getStateQuery);
  response.send(convertStateDbObjToResponseObj(DbState));
});

//POST DISTRICT API
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `INSERT INTO
                            district (district_name,state_id,cases,cured,active,deaths)
                            VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;

  await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});

// GET DISTRICT API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const selectDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const dbDistrict = await db.get(selectDistrictQuery);
    response.send(convertDistrictDbObjToResponseObj(dbDistrict));
  }
);

//DELETE DISTRICT API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//UPDATE DISTRICT API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `UPDATE district SET 
                                    district_name = '${districtName}',
                                    state_id = ${stateId},
                                    cases = ${cases},
                                    cured = ${cured},
                                    active = ${active},
                                    deaths = ${deaths};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//GET STATE STATISTICS
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStaticsQuery = `SELECT
                                        SUM(cases) AS totalCases,
                                        SUM(cured) AS totalCured,
                                        SUM(active) AS totalActive,
                                        SUM(deaths) AS totalDeaths
                                       FROM 
                                        district 
                                       WHERE 
                                        state_id = ${stateId};`;
    const stateStatics = await db.get(getStateStaticsQuery);
    response.send(stateStatics);
  }
);
module.exports = app;
