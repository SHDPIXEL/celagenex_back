const {Sequelize} = require('sequelize');

const sequelize = new Sequelize('celagenex','admin_celagen','iNbOk0xC77vQn7HgW2dw',{
    host: 'celagenex.ch26co64cgxa.ap-south-1.rds.amazonaws.com',
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
