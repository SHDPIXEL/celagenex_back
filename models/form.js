const { DataTypes } = require("sequelize");
const sequelize = require("../connection");
const User = require("../models/user");

const Form = sequelize.define(
  "Form",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    emdId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User, // Foreign key reference
        key: "id",
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        notEmpty: true,
      },
    },
    speciality: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    hospital: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    image: {
      type: DataTypes.JSON,
      allowNull: true,
      validate: {
        isArray(value) {
          if (Array.isArray(value) && value.length > 1) {
            throw new Error("You can only upload a maximum of 1 image.");
          }
        },
      },
    },
    video: {
      type: DataTypes.JSON,
      allowNull: true,
      validate: {
        isArray(value) {
          if (Array.isArray(value) && value.length > 1) {
            throw new Error("You can only upload a maximum of 1 video.");
          }
        },
      },
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Processing', 'Completed', 'Failed'),
      defaultValue: 'Pending'
    },
    del: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
  },
  { timestamps: true }
);

// Add association
Form.associate = (models) => {
  Form.hasOne(models.Video, {
    foreignKey: 'formId',
    as: 'Video'
  });
};

Form.sync({ force: false });
console.log("The table for the Form model was just (re)created!");

module.exports = Form;
