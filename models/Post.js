const mongoose = require('mongoose');
const {Schema, model} = mongoose;

const CommentSchema = new Schema({
    content: { type: String },
    author: { type: Schema.Types.ObjectId, ref: 'user' },
  }, {
    timestamps: true,
  });

const PostSchema = new Schema({
    title:{type: String},
    summary:{type: String},
    content:{type: String},
    cover:{type: String},
    author:{type:Schema.Types.ObjectId, ref:'user'},
    likedIds: [{ type: Schema.Types.ObjectId, ref: 'user' }],
    comments: [CommentSchema],
},{
    timestamps:true,
});

const PostModel = model('Post',PostSchema);

module.exports = PostModel;