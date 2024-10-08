const User = require("../models/user");
const bcrypt = require("bcrypt");
const { generateToken } = require("../common/jwt");
const sendEmail = require("../common/mailService");
const EmailVerify = require("../models/emailVerify");

/* checking user already registered using email */
const checkUserAlreadyRegistered = async (req, res) => {
    try {
      const { email } = req.body;
  
      if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
      }
  
      const trimmedEmail = email.trim();
      
      // Regular expression to check for valid email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }
  
      const emailExists = await User.findOne({
        email: { $regex: new RegExp('^' + trimmedEmail + '$', 'i') }
      }).lean();
  
      if (emailExists) {
        return res.status(200).json({ emailExists: true });
      } else {
        return res.status(200).json({ emailExists: false });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };
  

/* register */
const register = async (email, title, firstName, lastName, password, mobileNumber, address, city, country, postCode, role) => {
  try{
    // Check for required fields
    if (!email || (role === "User" && !title) || !firstName || !password || (role === "User" && !mobileNumber) || (role === "User" && !address) || !role) {
      return {
          error: "Please fill all required fields!",
          status: 400
      };
    }

    const isEmailVerified = await EmailVerify.findOne({ email: email.toLowerCase(), verifyStatus: true});

    if(!isEmailVerified){
      return {
        error: "Please verify your email first!",
        status: 400
      };
    };

    // Validate email and phone number
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\d{9,}$/;

    if (!emailRegex.test(email.trim())) {
        return {
            error: "Invalid email format!",
            status: 400
        };
    }

    if (role === "User" && !phoneRegex.test(mobileNumber)) {
        return {
            error: "Invalid phone number format!",
            status: 400
        };
    }

    // Check if user is already registered
    const userAlreadyRegistered = await User.findOne({ email: email.toLowerCase() }).lean();
    if (userAlreadyRegistered) {
        return {
            error: "User already registered with this email!",
            status: 400
        };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create a new user
    const user = new User({
        email: email.toLowerCase(),
        title,
        firstName,
        lastName,
        password: hashedPassword,
        mobileNumber,
        address,
        role,
        city,
        country,
        postCode
    });

    // Save the user to the database
    await user.save();
    const userObject = user.toObject({ getters: true });
    delete userObject.password;

    const emailResponse = await sendEmail(
      user.email,
      'Welcome to Shop name!',
      `
          <div style="padding: 20px; font-family: Calibri;">
              <div style="text-align: center;">
                  <a href="webaddress"><img src="logo" alt="Shopname Logo" width="80" height="80"></a>
              </div>
              <div style="margin-top: 40px; font-size: 15px;">
                  <p>Dear ${user.firstName},</p>
                  <p>Thank you for registering in Shopname! We're excited to have you on board.</p>
                  <p>If you have any questions, please contact our support team at <a href="mailto:supportaddress">supportaddress</a>.</p>
                  <p>Thank you for choosing Shopname. We look forward to serving you.</p>
              </div>
          </div>
      `
  );

    // Return the created user
    return {
        user : userObject,
        status: 201,
        emailSent: emailResponse.emailSent,
        mailMsg: emailResponse.message,
        message:"Registered successfully!",
        info: emailResponse.info || null,
        error: emailResponse.error || null
    };
  }catch(err){
    return {
      error: err.message,
      status: 500
    };
  }
}

/* login */
const login = async (email, password, role) => {
    try { 
      if (!email || !password) {
        return {
          error: "Please provide login credentials",
          status: 403
        };
      }
  
      const user = await User.findOne({ email: email.toLowerCase(), role }).select('+password').lean();
      if (!user) {
        return {
          error: "User does not exist.",
          status: 400
        };
      }
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return {
          error: "Invalid password.",
          status: 400
        };
      }
  
      const token = generateToken(user, process.env.JWT_SECRET);
  
      delete user.password;
      
      return {
        token,
        user,
        status: 200
      };
    } catch (err) {
      return {
        error: err.message,
        status: 500
      };
    }
  };
  

module.exports = {
    checkUserAlreadyRegistered,
    register,
    login
}