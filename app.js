const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError= require("./utils/Expresserror.js")
const asyncWrap= require("./utils/wrapAsync.js")
const {listingSchema, reviewSchema}= require("./schema.js")
const Review = require("./models/review.js");
const cookieParser= require("cookie-parser");
const session=require("express-session");
const flash=require("connect-flash");
const passport=require("passport");
const localStrategy=require("passport-local");
const User = require("./models/user.js");
const {isLoggedIn}= require("./middleware.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));//parsing of nested objects in the URL-encoded data
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);//gives templates
app.use(express.static(path.join(__dirname,"public")));//to use public folder
// app.use(cookieParser("secretcode"));//to use cookie parser package, every cookie will execute this middleware

//using of sessions
const sessOptions={
  secret:"secretcode",//string used to sign the session ID cookie. important for security purposes to prevent tampering with the session cookie.
  resave:false,//Setting it to false can optimize server performance by only saving sessions that have been modified.
  saveUninitialized:true,//This property determines whether to save uninitialized sessions. Setting it to true will save new sessions to the session store, even if they haven't been modified.
  cookie:{
    expires: Date.now()+ 7*24*60*60*1000,//temporary data store kare usse 7 din tak info stored ho basically yaha 7 din jo ki milli second mei diya hai(7days*24hours*60mins*60sec*1000ms) 
    maxAge:7*24*60*60*1000,
    httpOnly:true,//for security purposes-restricts access to the cookie only through the HTTP protocol
  },
};
app.use(session(sessOptions));
app.use(flash());

//configuring strategy
app.use(passport.initialize());//to initialise passport
app.use(passport.session());//web app needs the ability to identify users as they browse from page to page
passport.use(new localStrategy(User.authenticate()));//LocalStrategy is a strategy provided by Passport.js for authenticating with a username and password.
passport.serializeUser(User.serializeUser());//to serialize users into the session
passport.deserializeUser(User.deserializeUser());//ulta upar ka

app.use((req,res,next)=>{
  res.locals.currUser=req.user;
  next();
})
// app.get("/demouser", async(req,res)=>{
//   let fakeuser=new User({
//     email:"sujalsinha10@gmail.com",
//     username:"heyasujalhere"
//   });
//   let registereduser=await User.register(fakeuser,"helloworld");//a static method of passport stores user and its password, also checks if username is unique
//   res.send(registereduser);
// });

//SignUp routes
app.get("/signup",async(req,res)=>{
  res.render("users/signup.ejs");
});

app.post("/signup",asyncWrap(async(req,res)=>{
  try {
    let{username,email,password}=req.body;
   const Userinfo=new User({
    email:email,
    username:username
   });
   let registereduser=await User.register(Userinfo,password);
   console.log(registereduser);
   req.login("registereduser",(err)=>{
    if(err){
      next(err);
    }
    req.flash("success","Welcome To WanderLust :)");
   res.redirect("/listings");
   })
   
  } catch (error) {
    req.flash("error",error.message);
    res.redirect("/signup");
    
  }
}));

app.get("/login",(req,res)=>{
  res.locals.errorMsg=req.flash("error");
  res.render("users/login.ejs");
});

app.post("/login",passport.authenticate("local",{
  failureRedirect:"/login",
  failureFlash:true,
}),async(req,res)=>{
  req.flash("success","Welcome To WanderLust :)");
  res.redirect("/listings");
});

//logout route 
app.get("/logout",(req,res)=>{
  req.logout((err)=>{
    if(err){
      next(err);
    }
    req.flash("success","Logged Out Successfully :)");
    res.redirect("/listings");
  })
}) 

const validateListing=(req,res,next)=>{
  let {error}=listingSchema.validate(req.body);
  if(error){
    let errMsg=error.details.map((el)=>el.message).join(",");
    throw new ExpressError(4000,errMsg);
  }else{
    next();
  }
}

const validateReview=(req,res,next)=>{
    let {error}=reviewSchema.validate(req.body);
    if(error){
      let errMsg=error.details.map((el)=>el.message).join(",");
      throw new ExpressError(4000,errMsg);
    }else{
      next();
    }
}

//COOKIES
// app.get("/getsignedcookies",(req,res)=>{
//   res.cookie("greet","hello",{signed:true});//cookies name and its value
//   res.send("sent signed cookies");
// })

// app.get("/verify",(req,res)=>{
//   console.log(req.cookies);
//   res.send("verified");
// })

//listings
//Index Route-to return all the listings
app.get("/listings",asyncWrap(  async (req, res) => {
  const allListings = await Listing.find({});
  res.locals.successMsg=req.flash("success");//we can directly pass it as an object like successMsg=req.flash("success"); too
  res.locals.errorMsg=req.flash("error");
  res.render("listings/index.ejs", { allListings });//passing flash message
}));

//New Route-part of create crud
app.get("/listings/new",isLoggedIn, (req, res) => {
  //below method is used to check whether user is logged in or not
  console.log(req.user);
  
  res.render("listings/new.ejs");
});

//Show Route-to display any specific listing(CRUD - READ)
app.get("/listings/:id", asyncWrap( async (req, res) => {
  let { id } = req.params;
  //to populate meaning to use the data over here too of mentioned in bracket
  const listing = await Listing.findById(id).populate("reviews").populate("owner");
  if(!listing){
    req.flash("error","Listing does not exist!");
    res.redirect("/listings");
  }
  res.render("listings/show.ejs", { listing });
}));

//Create Route - to create and display that list(CRUD - CREATE)
app.post("/listings",isLoggedIn,validateListing,asyncWrap( async (req, res,next) => {
  let result= listingSchema.validate(req.body)
  if(result.error){
    throw new ExpressError(400,result.error);
  }
  const newListing = new Listing(req.body.listing);//or extract on the basis of name {title,description,location,country,price}=req.body
  //here req.body.listing listing is the object that is containing its key like title,,description,location,country,price check new.ejs
  newListing.owner=req.user._id;
  await newListing.save();
  req.flash("success","New Listing Created :)");
  res.redirect("/listings");}
));

//Edit Route
app.get("/listings/:id/edit",isLoggedIn, asyncWrap( async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  res.render("listings/edit.ejs", { listing });
}));

//Update Route
app.put("/listings/:id",isLoggedIn,asyncWrap(async (req, res) => {
  let { id } = req.params;
  await Listing.findByIdAndUpdate(id, { ...req.body.listing });
  req.flash("success","Listing succesfully Updated :)");
  res.redirect(`/listings/${id}`);//goes to show route 
}));

//Delete Route
app.delete("/listings/:id",isLoggedIn, asyncWrap( async (req, res) => {
  let { id } = req.params;
  let deletedListing = await Listing.findByIdAndDelete(id);
  console.log(deletedListing);
  req.flash("success","Listing succesfully deleted :)");
  res.redirect("/listings");
}));


//REVIEWS

//post route
app.post("/listings/:id/reviews",validateReview,isLoggedIn,asyncWrap(async(req,res)=>{
  let listing=await Listing.findById(req.params.id);
  let newReview=new Review(req.body.review);
  listing.reviews.push(newReview);
  await newReview.save();
  await listing.save();
  // console.log("new response saved");
  // res.send("saved");
  res.redirect(`/listings/${listing._id}`);
}));

//delete route
app.delete("/listings/:id/reviews/:reviewId",asyncWrap(async(req,res)=>{
  let {id,reviewId}=req.params;
  await Listing.findByIdAndUpdate(id,{$pull:{reviews:reviewId}});//to update in the main listings collection also after rmoval of review pull is used to remove a value from an array 
  let review= await Review.findByIdAndDelete(reviewId);
  console.log(review);
  res.redirect(`/listings/${id}`);

}));


// app.get("/testListing", async (req, res) => {
//   let sampleListing = new Listing({
//     title: "My New Villa",
//     description: "By the beach",
//     price: 1200,
//     location: "Calangute, Goa",
//     country: "India",
//   });

//   await sampleListing.save();
//   console.log("sample was saved");
//   res.send("successful testing");
// });
app.all("*",(req,res,next)=>{
  next(new ExpressError(404,"Page not found"));
})
// error handling middleware
app.use((err,req,res,next)=>{
    let {status=500 , message="Some error occured"}= err;
    // res.status(status ).send(message);
    res.status(status).render("error.ejs",{message});
});

app.listen(8080, () => {
  console.log("server is listening to port 8080");
});