const {Sequelize} = require('sequelize');

const sequelize = new Sequelize('celagenex','celagenex_u','8u3Hs4RBiaATxj%xfRV$KT_cG',{
    host: '127.0.0.1',
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
