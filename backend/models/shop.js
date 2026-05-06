const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema({
  name: String,
  category: String,
  location: {
    lat: Number,
    lng: Number
  },
  open: Boolean,
  rating: Number,
  products: [
    {
      name: String,
      quantity: Number
    }
  ]
});

module.exports = mongoose.model("Shop", shopSchema);