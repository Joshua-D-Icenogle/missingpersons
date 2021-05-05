const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const path = require('path');
const flash = require('connect-flash');
const request = require('request')
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(flash())

mongoose.connect(process.env.DB, {
    useNewUrlParser: true,
     useUnifiedTopology: true,
     useFindAndModify: false
});

mongoose.set('useCreateIndex', true);
db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
console.log("Connection Successful")
})


const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    imgUrl: String,
    imgDelete: String,
    firstName: String,
    lastName: String,
    leads: [Object],
})

const User = mongoose.model("User", UserSchema);

const PersonSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    imgDelete: String,
    dob: String,
    feet: Number,
    inches: Number,
    hair: String,
    eyes: String,
    gender: String,
    race: String,
    weight: Number,
    city: String,
    state: String,
    uploadedBy: String,
    uploadedById: String,
    imgUrl: String,
    numOfLeads: Number,
    leads: Array,
    status: String,
    zip: String,
})

const Person = mongoose.model("Person", PersonSchema);


const LeadSchema = new mongoose.Schema({
    personName: String,
    personId: String,
    senderName: String,
    senderId: String,
    message: String,
    recipientName: String,
    recipientId: String,
    timeSent: String,
    opened: Boolean,
})

const Lead = mongoose.model("Lead", LeadSchema);

const MessageSchema = new mongoose.Schema({
    senderName: String,
    senderId: String,
    message: String,
    recipientId: String,
    recipientName: String,
    opened: Boolean,
})

const Message = mongoose.model("Message", MessageSchema);


// Img upload
////////////////////

app.use(express.static(__dirname + '/public'));

cloudinary.config({ 
    cloud_name: 'ded10lja0', 
    api_key: process.env.API_KEY, 
    api_secret: process.env.API_SECRET 
  });


// Set The Storage Engine
storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb){
      cb(null,file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
  });
  
  // Init Upload
upload =  multer({
    storage: storage,
    limits:{fileSize: 1000000},
    fileFilter: function(req, file, cb){
      checkFileType(file, cb);
    }
  }).single('img');
  
  // Check File Type
  function checkFileType(file, cb){
    // Allowed ext
    const filetypes = /jpeg|jpg|png|gif/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype);
  
    if(mimetype && extname){
      return cb(null,true);
    } else {
      cb('Error: Images Only!');
    }
  }
  
  
/////////////////////////////


//Middleware

// app.use(bodyParser.urlencoded({extended:true}));
// app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}))
app.use(express.urlencoded({extended: true}))
app.use(express.json())

//Passport.js

app.use(passport.initialize())
app.use(passport.session())

//Serialize User
passport.serializeUser(function (user, done) {
    done(null, user.id)
})
//Deserialize User
passport.deserializeUser(function(id, done) {
    //Setup user model
    User.findById(id, function (err, user) {
        done(err, user);
    })
})
//Create Strategy
passport.use(new localStrategy({
    //Make the request object available (req)
    passReqToCallback: true
},
    function(req, username, password, done) {
        User.findOne({username: username}, function(err, user) {
            if (err) {return done(err)}
            //Handle wrong username
            if (!user) {return done(null, false, req.flash('error', 'User not found'))}
            //Compare Password
            bcrypt.compare(password, user.password, function (err, res) {
                console.log(res)
                if (err) {return done(err)};
                //Handle wrong password
                if (res===false) {
                    
                    return done(null, false, req.flash('error', 'Password is incorrect'))
                }
                //Return user if username and password are valid
                return done (null, user)
            })
        })
    }
))



//Routes


app.get('/', (req,res) => {
    Person.find({}, (err, people) => {
        if (req.isAuthenticated()) {
            res.render('home', {isLoggedIn: true, userId: req.user._id, people: people.reverse()})
        } else {
            res.render('home', {isLoggedIn: false, people: people.reverse()})
        }
    })
})

app.get('/profile', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect(`/profile/${req.user._id}`)
    } else {
        res.redirect('/login')
    }
})

app.get('/profile/:id', async (req, res) => {
    if (req.isAuthenticated()) {
        if (req.params.id == req.user._id) {
            const data = await User.findOne({_id: req.params.id}, 'imgUrl lastName firstName _id')
            const people = await Person.find({uploadedById: req.user._id})
            const leads = await Lead.find({recipientId: req.user._id})
            const messages = await Message.find({recipientId: req.user._id})
            res.render('myProfile', {isLoggedIn: true, userId: req.user._id, data: data, people: people.reverse(), messages: messages.reverse(), leads: leads.reverse()}); 
        } else {
            const data = await User.findOne({_id: req.params.id}, 'imgUrl lastName firstName _id')
            const people = await Person.find({uploadedById: req.params.id})
            res.render('profile', {isLoggedIn: true, userId: req.user._id, data: data, people: people.reverse()});   
        }
    } else {
        const data = await User.findOne({_id: req.params.id}, 'imgUrl lastName firstName _id')
        const people = await Person.find({uploadedById: req.params.id})
        res.render('profile', {isLoggedIn: false, userId: '', data: data, people: people.reverse()});
    }
})

app.get('/login', (req,res) => {
    const errors = req.flash().error || [];
    if (req.isAuthenticated()) {
        res.redirect('/profile')
    } else {
        res.render('login', {errors: errors, isLoggedIn: false})
    }
})

app.get('/register', (req,res) => {
    const errors = req.flash().error || [];
    if (req.isAuthenticated()) {  
        res.render('register', {errors: errors, isLoggedIn: true,  id: req.user._id})
    } else {
        res.render('register', {errors: errors, isLoggedIn: false})
    }
})

app.post('/register', async (req, res) => {
    const exists = await User.exists({username: req.body.username})
    if (exists) {
        req.flash('error', 'User Already exists')
        res.redirect('/register')
        return;
    }

    if (!req.body.fname || !req.body.lname || !req.body.username || !req.body.password) {
        req.flash('error', 'Please fill all fields')
        res.redirect('/register')
        return;
    }
    bcrypt.hash(req.body.password, 10, function (err, hash){
        if (err) return next(err);
        const newUser = new User({
            firstName: req.body.fname,
            lastName: req.body.lname,
            username: req.body.username,
            password: hash,
            findCount: 0,
            imgUrl: '/blank_profile.png',
            imgDelete: ''
        })
        newUser.save(function (err, user) {
            console.log(user._id)
        })
        res.redirect('/login')
    })

})

app.post('/login', passport.authenticate('local', {successRedirect: '/profile', failureRedirect: '/login', failureFlash: true}));

app.get('/logout', (req, res) => {
    req.logout()
    res.redirect('/login')
})

app.get('/person/:id', (req, res) => {
    Person.findOne({_id: req.params.id}, (err, person) => {
        User.findOne({_id: person.uploadedById}, (err, user) => {
            if (err) {console.log(err); res.redirect('/');}
            if (req.isAuthenticated()) {
                res.render('person', {isLoggedIn: true, person: person, userId: req.user._id, postedBy: {fname: user.firstName, lname: user.lastName}})
            } else {
                res.render('person', {isLoggedIn: false, person: person, userId: '', postedBy: {fname: user.firstName, lname: user.lastName}})
            }  
        })    
    })
    
})

app.get('/new-person', (req, res) => {
    const errors = req.flash().error || [];
    if (req.isAuthenticated()) {
        res.render('newPerson', {isLoggedIn: true, userId: req.user._id, errors: errors})
    } else {
        res.redirect('/login')
    }
})


//User Control Routes

app.post('/update-profile/:id', async (req, res) => {
    if (req.isAuthenticated() || req.params.id == req.user._id) {
        await Message.updateMany({senderId: req.params.id}, {senderName: `${req.body.fname} ${req.body.lname}`});
        User.findOneAndUpdate({_id: req.user._id}, {firstName: req.body.fname, lastName: req.body.lname}, function (err, user) {
            res.redirect(`/profile/${req.user._id}`);
        })
    } else {
        res.redirect('/login');
    }    
})

app.post('/post-person', (req, res) => {
    if (req.isAuthenticated()) {
        upload(req, res, err => {
            if (err) {
                console.log(err);
            } else {
                cloudinary.uploader.upload(__dirname + `/uploads/${req.file.filename}`, function(error, result) {
                    var options = { 
                        url: `https://app.zipcodebase.com/api/v1/search?apikey=${process.env.ZIP_KEY}&codes=${req.body.zip}&country=US` 
                    };
                    function callback (err, response, body) {
                        if (!error && response.statusCode == 200) {
                            const data = JSON.parse(body).results[req.body.zip][0];
                            const newPerson = new Person({
                                firstName: req.body.fname,
                                lastName: req.body.lname,
                                zip: req.body.zip,
                                dob: req.body.dob,
                                feet: req.body.feet,
                                inches: req.body.inches || 0,
                                hair: req.body.hair,
                                eyes: req.body.eye,
                                gender: req.body.gender,
                                race: req.body.race,
                                city: data.city,
                                state: data.state,
                                uploadedBy: req.user.firstName + " " + req.user.lastName,
                                uploadedById: req.user._id,
                                imgUrl: result.url || '/blank_user.png',
                                numOfLeads: 0,
                                leads: [],
                                imgDelete: result.public_id,
                                weight: req.body.weight,
                                status: "Missing",
                            })

                            if (req.body.fname&&req.body.lname&&req.body.zip&&req.body.dob&&
                                req.body.feet&&req.body.hair&&req.body.eye&&req.body.gender&&
                                req.body.race&&req.body.weight) {

                                newPerson.save()
                                res.redirect('/profile');

                            } else {
                                req.flash('error', 'Please fill out all fields.')
                                res.redirect('/post-person')
                            }
                        } else {
                            req.flash('error', 'Please enter a valid zipcode.')
                            res.redirect('/post-person')
                        }
                    }

                  request(options, callback)

                }).then((r)=>{
                    fs.unlink(__dirname + `/uploads/${req.file.filename}`, (err) => {
                        if (err) throw err;
                        console.log("Successful deletion");
                    });
                })
        
            }
        })
    } else {
        res.redirect('/login')
    }
})

app.get('/edit-person/:id', (req, res) => {
    if (req.isAuthenticated()) {
        const errors = req.flash().error || [];
        let success = '';
        if (req.query.saved) {
            success = 'Successfuly saved changes.'    
        }
        Person.findOne({_id: req.params.id}, (err, person) => {
            if (person.uploadedById == req.user._id) {
                res.render('editPerson', {isLoggedIn: true, userId: req.user._id, person: person, errors: errors, success: success})
            } else {
                res.redirect('/')
            }
        })
    } else {
        res.redirect('/login')
    }
})



app.post('/edit-person/:id', async (req, res) => {
    if (req.isAuthenticated()) {
        Person.findOne({_id: req.params.id}, (err, person) =>{
            if (!person || !person.uploadedById == req.user._id) {
                res.redirect('/profile')
            } else {
                var options = { 
                    url: `https://app.zipcodebase.com/api/v1/search?apikey=${process.env.ZIP_KEY}&codes=${req.body.zip}&country=US` 
                }; 
               async function callback (error, response, body) {
           
                    if (!error && response.statusCode == 200) {
                        const data = JSON.parse(body).results[req.body.zip][0];
                        console.log(data)
                        await Person.updateOne({_id: req.params.id}, {
                                firstName: req.body.fname,
                                lastName: req.body.lname,
                                zip: req.body.zip,
                                dob: req.body.dob,
                                feet: req.body.feet,
                                inches: req.body.inches || 0,
                                hair: req.body.hair,
                                eyes: req.body.eye,
                                gender: req.body.gender,
                                race: req.body.race,
                                lastSeen: req.body.lastSeen,
                                city: data.city,
                                state: data.state,
                                uploadedBy: req.user.firstName + " " + req.user.lastName,
                                uploadedById: req.user._id,
                                numOfLeads: 0,
                                leads: [],
                                weight: req.body.weight,
                            })

                            res.redirect(`/edit-person/${req.params.id}?saved=true`)
                    }
                }
                if (req.body.fname&&req.body.lname&&req.body.zip&&req.body.dob&&
                    req.body.feet&&req.body.hair&&req.body.eye&&
                    req.body.gender&&req.body.race&&req.body.lastSeen&&req.body.weight) {
                    request(options, callback);
                } else {
                    req.flash('error', "Please fill out all fields.")
                    res.redirect(`/edit-person/${req.params.id}`);
                }
            }
        })
    } else {
        res.redirect('/login');
    }
})

app.post('/submit-lead/:id', async (req,res) => {
    if (req.isAuthenticated()) {
        const personData = await Person.findOne({_id: req.params.id})

        const newLead = new Lead({
            personName: `${personData.firstName} ${personData.lastName}`,
            personId: `${personData._id}`,
            senderName: `${req.user.firstName} ${req.user.lastName}`,
            senderId: req.user._id,
            recipientId: personData.uploadedById,
            message: req.body.message,
            opened: false
        })
        newLead.save()
        res.redirect(`/person/${req.params.id}`)
    } else {
        res.redirect('/login');
    }
})

app.get('/lead/:id', (req, res) => {
    if (req.isAuthenticated()) {
        Lead.findOne({_id: req.params.id}, async (err, lead) => {
            if (req.user._id == lead.recipientId) {
                if (!lead.opened) {
                    await Lead.updateOne({_id: req.params.id}, {opened: true});
                }
                res.render('lead', {isLoggedIn: true, userId: req.user._id, lead: lead})
            } else {
                res.redirect('/')
            }    
        })

    } else {
        res.redirect('/login')
    }
})

app.get('/delete-person/:id', (req, res) => {
    if (req.isAuthenticated()) {
        Person.findOne({_id: req.params.id}, async (err, person) => {
            if (person.uploadedById == req.user._id) {
                cloudinary.uploader.destroy(person.imgDelete);
                await Person.deleteOne({_id: req.params.id})
                res.redirect('/profile')
            } else {
                res.redirect('/');
            }
        })
    } else {
        res.redirect('/login');
    }
})

app.post('/send-message/:id', (req, res) => {
    if(req.isAuthenticated()) {
        User.findOne({_id: req.params.id}, (err, user) => {
            const newMessage = new Message({
                recipientName: `${user.firstName} ${user.lastName}`,
                recipientId: user._id,
                senderId: req.user._id,
                senderName: `${req.user.firstName} ${req.user.lastName}`,
                message: req.body.message,
                opened: false
            })
            newMessage.save()
            res.redirect(`/profile/${req.params.id}`)
        })
        
    } else {
        res.redirect(`/login`)
    }

})

app.get('/conversation/:id', (req, res) => {
    if (req.isAuthenticated()) {
        Message.findOne({_id: req.params.id}, async (err, message) => {
            if (message.recipientId == req.user._id) {
                const messages = await Message.find({ $or:[ {recipientId: req.user._id, senderId: message.senderId}, {senderId: req.user._id, recipientId: message.senderId} ]})
                await Message.updateOne({_id: req.params.id}, {opened: true})
                res.render('conversation', {isLoggedIn: true, userId: req.user._id, messages: messages.reverse(), replyId: req.params.id})
            } else {
                res.redirect('/profile')
            }
        })

    } else {
        res.redirect('/login')
    }
})

app.post('/reply/:id', (req, res) => {
    if(req.isAuthenticated()) {
        Message.findOne({_id: req.params.id}, (err, message) => {
            User.findOne({_id: message.senderId}, (err, user) => {
                const newMessage = new Message({
                    senderName: `${req.user.firstName} ${req.user.lastName}`,
                    senderId: req.user._id,
                    recipientName: `${user.firstName} ${user.lastName}`,
                    recipientId: user._id,
                    message: req.body.message
                })
                newMessage.save()
                res.redirect(`/conversation/${req.params.id}`)
            })
        })
    } else {
        res.redirect(`/login`)
    }

})

app.post('/update-person-image/:id', (req, res) => {
    if(req.isAuthenticated()) {
        Person.findOne({_id: req.params.id}, (err, person) => {
            if (person.uploadedById == req.user._id) {
                upload(req, res, err => {
                    if (err) {
                        console.log(err);
                    } else {
                        cloudinary.uploader.destroy(person.imgDelete);
                        cloudinary.uploader.upload(__dirname + `/uploads/${req.file.filename}`, async function(error, result) {
                            await Person.updateOne({_id: req.params.id}, {imgUrl: result.url, imgDelete: result.public_id})
                        }).then((r)=>{
                            fs.unlink(__dirname + `/uploads/${req.file.filename}`, (err) => {
                            if (err) console.log(error);
                            console.log("Successful deletion");
                            });
                            res.redirect('/profile')  
                        })
                    } 
                })
            } else {
                res.redirect('/profile');
            }
        });
    } else {
        res.redirect('/login')
    }
})

app.post('/update-profile-image/:id', (req, res) => {
    if (req.isAuthenticated()) {
        User.findOne({_id: req.params.id}, (err, user) => {
            console.log(req.params.id, req.user._id)
            if (req.params.id == req.user._id) {
                if (user.imgDelete !== '') {
                    cloudinary.uploader.destroy(user.imgDelete);
                } 
                upload(req, res, err => {
                    if (err) {
                        console.log(err);
                    } else {   
                        cloudinary.uploader.upload(__dirname + `/uploads/${req.file.filename}`, function(error, result) {
                            User.updateOne({_id: req.params.id}, {imgUrl: result.url, imgDelete: result.public_id}).then(x => {
                                res.redirect('/profile')
                            })
                        }).then((r)=>{
                            fs.unlink(__dirname + `/uploads/${req.file.filename}`, (err) => {
                                if (err) throw err;
                                console.log("Successful deletion");
                            });
                        })
                    }
                })
            } else {
                res.redirect('/')
            }
        })
    } else {
        res.redirect('/login')
    }
})


app.listen(process.env.PORT, ()=>console.log(process.env.PORT))