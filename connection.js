const {Sequelize} = require('sequelize');

const sequelize = new Sequelize('test','admin_check_cela','uaMdf5Vs6MDkx79LOnJj',{
    host: 'celagenex-check.ch26co64cgxa.ap-south-1.rds.amazonaws.com',
    dialect: 'mysql'
});


sequelize.authenticate()
try{
    console.log('Database Connected Succesfully');
}catch(error){
    console.log('Unable to connect to the database:', error);
}

sequelize.authenticate().then(()=>console.log("Database Connected"))

module.exports = sequelize; 
