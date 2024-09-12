const Order = require("../models/order");
const SupportTic = require("../models/supportTic");
const User = require("../models/user");

/* view orders (common for both user and admin) */
const getAllOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, reqUserId } = req.query;
        const { id, role } = req.user;

        // Validate page and limit values
        const parsedPage = parseInt(page);
        const parsedLimit = parseInt(limit);

        if (isNaN(parsedPage) || parsedPage <= 0 || isNaN(parsedLimit) || parsedLimit <= 0) {
            return res.status(400).json({ error: "Page and limit must be positive integers" });
        }

        // Construct the query object
        const query = {};
        if (role === "User") {
            query.userId = id;
        } else if (role === "Admin" && reqUserId) {
            query.userId = reqUserId;
        }

        if (status && ['Pending', 'Confirmed', 'Delivered', 'Cancelled', 'Rejected'].includes(status)) {
            query.status = status;
        } else if (status) {
            return res.status(400).json({ error: "Invalid status" });
        }

        // Count total documents matching the query
        const totalCount = await Order.countDocuments(query);

        // Calculate the number of documents to skip
        const skip = (parsedPage - 1) * parsedLimit;

        // Fetch the orders with pagination
        const allOrders = await Order.find(query)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(parsedLimit)
            .lean()
            .exec();

        if (allOrders.length === 0) {
            return res.status(404).json({ error: "No orders found" });
        }

        // If the role is Admin and reqUserId is not provided, append user details
        if (role === "Admin" && !reqUserId) {
            const userDetails = await User.find({
                _id: { $in: allOrders.map(order => order.userId) }
            }).select("-password").lean().exec();

            const userDetailsMap = userDetails.reduce((acc, user) => {
                acc[user._id] = user;
                return acc;
            }, {});

            allOrders.forEach(order => {
                if (userDetailsMap[order.userId]) {
                    order.user = userDetailsMap[order.userId];
                }
            });
        } else if (role === "User" || (reqUserId && role === "Admin")) {
            const user = await User.findById(role === "User" ? id : reqUserId).select("-password").lean().exec();
            allOrders.forEach(order => {
                order.user = user;
            });
        }

        // Return the fetched orders along with pagination details
        return res.status(200).json({
            currentPage: parsedPage,
            totalPages: Math.ceil(totalCount / parsedLimit),
            totalCount,
            data: allOrders,
        });
    } catch (err) {
        // Return 500 if an error occurs
        res.status(500).json({ error: err.message });
    }
};

/* get all support tic (common for both user and admin) */
const getAllSupportTic = async (req, res) => {
    try {
        // Extract query parameters and user information from the request
        const { page = 1, limit = 10, reqUserId } = req.query;
        const { id, role } = req.user;

        // Parse page and limit as integers
        const parsedPage = parseInt(page);
        const parsedLimit = parseInt(limit);

        // Validate page and limit values
        if (isNaN(parsedPage) || parsedPage <= 0 || isNaN(parsedLimit) || parsedLimit <= 0) {
            return res.status(400).json({ error: "Page and limit must be positive integers" });
        }

        // Construct the query object
        const query = {};
        if (role === "User") {
            query.userId = id;
        } else if (role === "Admin" && reqUserId) {
            query.userId = reqUserId;
        }

        // Count total documents matching the query
        const totalCount = await SupportTic.countDocuments(query);

        // Calculate the number of documents to skip based on the current page
        const skip = (parsedPage - 1) * parsedLimit;

        // Find support tickets based on query, pagination, and sorting
        const allSupportTic = await SupportTic.find(query)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(parsedLimit)
            .lean()
            .exec();

        if (allSupportTic.length === 0) {
            return res.status(404).json({ error: "No support tickets found" });
        }

        // If the role is Admin and reqUserId is not provided, append user details
        if (role === "Admin" && !reqUserId) {
            const userDetails = await User.find({
                _id: { $in: allSupportTic.map(tic => tic.userId) }
            }).select("-password").lean().exec();

            const userDetailsMap = userDetails.reduce((acc, user) => {
                acc[user._id] = user;
                return acc;
            }, {});

            allSupportTic.forEach(tic => {
                if (userDetailsMap[tic.userId]) {
                    tic.user = userDetailsMap[tic.userId];
                }
            });
        } else if (role === "User" || (reqUserId && role === "Admin")) {
            const user = await User.findById(role === "User" ? id : reqUserId).select("-password").lean().exec();
            allSupportTic.forEach(tic => {
                tic.user = user;
            });
        }

        // Return the fetched support tickets along with pagination details
        return res.status(200).json({
            currentPage: parsedPage,
            totalPages: Math.ceil(totalCount / parsedLimit),
            totalCount,
            data: allSupportTic,
        });
    } catch (err) {
        // Return 500 if an error occurs
        return res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAllOrders,
    getAllSupportTic
};
