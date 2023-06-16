const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' }); 
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const salt = bcrypt.genSaltSync(10);
const secret = 'dfdsfioio545sfd56';

const app = express();
const port = process.env.API_PORT || 4000;
const dbUrl = process.env.DB_URL;


app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));




mongoose.connect(dbUrl);


mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });
  
  mongoose.connection.once('open', () => {
    app.post('/register', async (req, res) => {
        const {username,password} = req.body;
        try{
            const userDoc = await User.create({
                username,
                password:bcrypt.hashSync(password, salt),
            });
            res.json(userDoc);
        } catch(e){
            res.status(400).json(e);
        }
        
    });

    app.post('/login', async (req, res) => {
        const {username,password} = req.body;
        const userDoc = await User.findOne({username});
        const passOk = bcrypt.compareSync(password,userDoc.password);
        if (passOk){
            jwt.sign({username,id:userDoc._id},secret,{},(err,token)=>{
                if (err) throw err;
                res.cookie('token', token).json({
                    id:userDoc._id,
                    username,
                });
            });

        } else{
            res.status(400).json('wrong credential');
            
        };
    });

    app.get('/profile',(req,res)=>{
        const {token} = req.cookies;
        jwt.verify(token , secret,{},(err,info)=>{
            if(err) throw err;
            res.json(info);
        });
    });

    app.post('/logout', (req, res) => {
        res.clearCookie('token').json({ message: 'Logout successful' });
      });
      

    app.post('/post',uploadMiddleware.single('file'),async (req,res)=>{
        const {originalname,path} = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        const newPath = path+'.'+ext;
        fs.renameSync(path, newPath);

        const {token} = req.cookies;
        jwt.verify(token , secret,{},async (err,info)=>{
            const {title,summary,content} =req.body;
            const postDoc = await Post.create({
            title,
            summary,
            content,
            cover:newPath,
            author:info.id,
        })

            if(err) throw err;
            res.status(200).json(postDoc);
        });
        
    });
    
    app.get('/post', async (req, res) => {
        let currentUser = null;
        
        if (req.cookies.token) {
          const token = req.cookies.token;
          currentUser = jwt.verify(token, secret);
        }
        
        const posts = await Post.find()
          .populate('author', ['username']).populate({
            path: 'likedIds',
            select: 'username'
          })
          .sort({ createdAt: -1 })
          .limit(20);
      
        const populatedPosts = await Promise.all(
          posts.map((post) => {
            const likesCount = post.likedIds.length;
            const likedByCurrentUser = currentUser && post.likedIds.includes(currentUser.id);
            
            return {
              ...post.toObject(),
              likesCount,
              likedByCurrentUser,
            };
          })
        );
      
        res.json(populatedPosts);
      });
      
      

      app.get('/post/:id', async (req, res) => {
        const { id } = req.params;
        
        try {
          const post = await Post.findById(id)
            .populate('author', ['username'])
            .populate({
              path: 'likedIds',
              select: 'username'
            })
            .populate({
              path: 'comments.author',
              select: 'username'
            });
          
          res.json(post);
        } catch (err) {
          res.status(400).json({ error: 'Invalid post ID' });
        }
      });
      
      app.post('/post/:id/comment', async (req, res) => {
        const { id } = req.params;
        const { text } = req.body;
        const { token } = req.cookies;
        
        try {
          const decoded = jwt.verify(token, secret);
          const post = await Post.findById(id);
          
          const comment = {
            content:text,
            author: decoded.id
          };
          
          post.comments.push(comment);
          await post.save();
          
          res.status(200).json('Comment added');
        } catch (err) {
          res.status(401).json('Unauthorized');
        }
      });
    
      app.delete('/post/:id/comment/:commentId', async (req, res) => {
        const { id, commentId } = req.params;
        const { token } = req.cookies;
      
        try {
          const decoded = jwt.verify(token, secret);
          const post = await Post.findById(id);
      
          // Find the index of the comment within the comments array
          const commentIndex = post.comments.findIndex(comment => comment._id.toString() === commentId);
      
          // If the comment index is valid, remove the comment
          if (commentIndex !== -1) {
            // Ensure that only the author of the comment can delete it
            if (post.comments[commentIndex].author.equals(decoded.id)) {
              post.comments.splice(commentIndex, 1);
              await post.save();
              res.status(200).json('Comment deleted');
            } else {
              res.status(403).json('Forbidden: You are not authorized to delete this comment');
            }
          } else {
            res.status(404).json('Comment not found');
          }
        } catch (err) {
          res.status(401).json('Unauthorized');
        }
      });
        

    app.get('/edit/:id',async (req,res)=>{
        
        const {id} = req.params;
        res.json(await Post.findById(id).populate('author', ['username']));

    });

    app.put('/post',uploadMiddleware.single('file'),async (req,res)=>{
        let newPath = null;
        
        if (req.file){
            const {originalname,path} = req.file;
            const parts = originalname.split('.');
            const ext = parts[parts.length - 1];
            newPath = path+'.'+ext;
            fs.renameSync(path, newPath);}

        const {token} = req.cookies;
        jwt.verify(token , secret,{},async (err,info)=>{
            
            const {id,title,summary,content} =req.body;
            const postDoc = await Post.findById(id);
            const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
            if (!isAuthor){
                res.status(400).json('you are not the author');
            }
            
            await postDoc.updateOne({
            title,
            summary,
            content,
            cover:newPath ? newPath : postDoc.cover,
        })

            if(err) throw err;
            res.status(200).json(postDoc);
        });
        
    });

    
    app.delete('/post/:id', async (req, res) => {
    const { id } = req.params;
    const { token } = req.cookies;
    try {
        const decoded = jwt.verify(token, secret);
        const postDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(decoded.id);

        if (!isAuthor) {
        res.status(403).json('You are not the author of this post');
        return;
        }
        fs.unlink(postDoc.cover, (err) => {
            if (err) {
              console.error('Error deleting file:', err);
            }
          });
      
        await Post.findByIdAndDelete(id);
        res.status(200).json('Post deleted');
        } catch (err) {
        res.status(401).json('Invalid token');
    }
    });

    app.post('/post/:id/like', async (req, res) => {
        const { id } = req.params;
        const { token } = req.cookies;
      
        try {
          const decoded = jwt.verify(token, secret);
          const postDoc = await Post.findById(id);
      
          if (postDoc.likedIds.includes(decoded.id)) {
            res.status(400).json('You have already liked this post');
            return;
          }
      
          postDoc.likedIds.push(decoded.id);
          await postDoc.save();
      
          res.status(200).json('Post liked');
        } catch (err) {
          res.status(401).json('Invalid token');
        }
      });

      app.delete('/post/:id/unlike', async (req, res) => {
        const { id } = req.params;
        const { token } = req.cookies;
      
        try {
          const decoded = jwt.verify(token, secret);
          const postDoc = await Post.findById(id);
      
          if (!postDoc.likedIds.includes(decoded.id)) {
            res.status(400).json('You have not liked this post');
            return;
          }
      
          postDoc.likedIds = postDoc.likedIds.filter((userId) => userId.toString() !== decoded.id);
          await postDoc.save();
      
          res.status(200).json('Post unliked');
        } catch (err) {
          res.status(401).json('Invalid token');
        }
      });
          

    });


if(process.env.API_PORT){
    app.listen(port, '0.0.0.0', () => {
        console.log(`Server is running on port ${port}`);
      });
}
module.exports = app;
