const mongoose = require('mongoose');
const {Schema, model} = mongoose;


const UserSchema = new Schema({
    username:{type: String, required: true,min:4,unique:true},
    password:{type: String,}
});

const UserModel = model('user',UserSchema);

module.exports = UserModel;