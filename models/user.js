const { DataTypes } = require("sequelize");
const sequelize = require("../connection");

const generateUniqueId = () => {
  const getRandomSegment = () =>
    Math.floor(Math.random() * Math.pow(36, 4))
      .toString(36)
      .padStart(4, "0")
      .toLowerCase();
  return `${getRandomSegment()}-${getRandomSegment()}-${getRandomSegment()}`;
};

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      notEmpty: true,
    },
  },
  emp_code: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      notEmpty: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: "Password cannot be empty",
      },
      len: {
        args: [8, 100],
        msg: "Password must be between 8 and 100 characters.",
      },
    },
  },
},
{timestamps:true}
);

User.sync({force:false});
console.log("The table for the User model was just (re)created!")

module.exports = User;
