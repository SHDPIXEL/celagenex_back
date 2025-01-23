const { DataTypes } = require("sequelize");
const sequelize = require("../connection");
const Form = require("../models/form");

const Video = sequelize.define(
  "Video",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    formId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Form, // Foreign key reference
        key: "id",
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
  },
  { timestamps: true }
);

// Add association
Video.associate = (models) => {
  Video.belongsTo(models.Form, {
    foreignKey: 'formId',
    as: 'Form'
  });
};

Video.sync({ force: false });
console.log("The table for the Video model was just (re)created!");

module.exports = Video;
