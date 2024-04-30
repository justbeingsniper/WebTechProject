const mongoose = require('mongoose');
const Schema=mongoose.Schema;
const listingSchema = new mongoose.Schema({
    title :{
        type:String,
        required:true
    },
    description:{
        type : String,
        required:true
    },
    image:{
        type:String,
        set:(v)=> v===" " ? "https://unsplash.com/photos/the-night-sky-is-reflected-in-the-still-water-of-a-mountain-lake-85xbiAbVb9k":v,//agar user image nahi bhejta hai toh
       
    }, 
    price:{
        type:Number,
        required:true
    },
    location:{
        type:String
    },
    country:{
        type:String
    },
    reviews:[
        {
            type:Schema.Types.ObjectId,
            ref:"Review"
        }
    ],
    owner:{
        type:Schema.Types.ObjectId,
        ref:"User"
    }
});
const Listing= mongoose.model("Listing",listingSchema);
module.exports= Listing;