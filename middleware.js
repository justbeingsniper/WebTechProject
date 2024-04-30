module.exports.isLoggedIn=(req,res,next)=>{
    if(!req.isAuthenticated()){
        req.flash("error","user must be logged in :(");
        res.redirect("/login");
      }
      next();
}