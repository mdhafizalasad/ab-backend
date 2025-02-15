const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const fileUpload = require('express-fileupload');

const app = express();
const port = 3000;


// Middleware

// app.use(cors({
//     origin: [
//         "https://visa-a7d0e.web.app", // production URL
//         "http://localhost:3000"       // local development URL
//     ],
//     methods: "GET,POST,PUT,DELETE",
//     credentials: true
// }));


app.use(cors());
app.use(express.json());
app.use(fileUpload());

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rvwdp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

 const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rvwdp.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority&appName=Cluster0`;

 //mongodb+srv://@cluster0.rvwdp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0


// HardCoded

//const uri = "mongodb+srv://online-embassy:wm5Yp1OG508rdzBg@cluster0.rvwdp.mongodb.net/online-embassy?retryWrites=true&w=majority&appName=Cluster0";



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
        useNewUrlParser: true, 
    useUnifiedTopology: true, 
    maxPoolSize: 10 // Maintain up to 10 connections
    },
    connectTimeoutMS: 10000, // 10 সেকেন্ড ওয়েট করবে
    serverSelectionTimeoutMS: 5000 // ৫ সেকেন্ডের মধ্যে কানেকশন চেষ্টা করবে
});

  
async function connectToDatabase() {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
        console.log("Connected to MongoDB");
    }
    return client.db('online-embassy');
}


app.get('/api/products', async (req, res) => {
    try {
        const database = await connectToDatabase();
        const productCollection = database.collection('my-products'); // Use your MongoDB collection name
        const products = await productCollection.find({}).toArray();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch products from MongoDB' });
    }
});

// MongoDB DELETE endpoint
app.delete('/api/products/:serial', async (req, res) => {
    const serial = parseInt(req.params.serial); // Get serial from URL params
  
    try {
      // Connect to MongoDB and get the collection
      const database = await connectToDatabase();
      const productsCollection = database.collection('my-products');
  
      // Perform the deletion operation in MongoDB
      const result = await productsCollection.deleteOne({ Serial: serial });
  
      if (result.deletedCount === 0) {
        return res.status(404).send('Product not found');
      }
  
      res.send(`Product with serial ${serial} successfully deleted`);
    } catch (err) {
      console.error('Error deleting product:', err);
      res.status(500).send('Failed to delete product');
    }
  });

  

//let usersCollection;
  
async function bootstrap() {
    try {
        await client.connect();
        const database = client.db('online-embassy');
        const serviceCollection = database.collection('services');
        const buyerOrdersCollection = database.collection('buyer-orders');
        const usersCollection = database.collection('Users');
        const ordersCollection = database.collection("orders");
        const bookingCollection = database.collection('bookings');
        const appointmentOptionCollection = database.collection('appointmentOptions');

        // Get all services
        app.get('/all-services', async (req, res) => {
            const query = {};
            const result = await serviceCollection.find(query).toArray();
            res.send(result);
        });

        // Get all Buyer

        app.get("/users/buyer/:email", async (req, res) => {
            const email = req.params.email;
        
            try {
                const user = await usersCollection.findOne({ email: email });
        
                if (!user) {
                    return res.status(404).json({ message: "User not found", isBuyer: false });
                }
        
                // ✅ `userType` ফিল্ড ব্যবহার করুন `role` এর পরিবর্তে
                res.json({ isBuyer: user.userType === "buyer" });
        
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: "Internal server error" });
            }
        });

        //  অর্ডার লোড করার API
        app.get("/orders/:email", async (req, res) => {
            const email = req.params.email;
            try {
                const orders = await ordersCollection.find({ buyerEmail: email }).toArray();
                res.json(orders);
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: "Internal Server Error" });
            }
        });



        // Assuming you're using Express and MongoDB

app.get("/buyer-orders", async (req, res) => {
    try {
      const buyerOrders = await buyerOrdersCollection.find().toArray(); // Fetch all orders from the collection
      res.json(buyerOrders); // Send the data as JSON
    } catch (error) {
      console.error("Error fetching buyer orders:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  
        // Backend route to check if the user is a seller
        app.get("/users/seller/:email", async (req, res) => {
            const email = req.params.email;
            
            try {
              const user = await usersCollection.findOne({ email: email });
        
              console.log("User Data:", user); // ✅ Debugging
        
              if (!user) {
                return res.status(404).json({ message: "User not found", isSeller: false });
              }
        
              res.json({ isSeller: user.userType === "seller" });
            } catch (error) {
              console.error(error);
              res.status(500).json({ message: "Internal server error" });
            }
        });
        
  
        //Stripe Payment API
        //const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.post("/create-payment-intent", async (req, res) => {
    const { price } = req.body;

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: price * 100, // Convert to cents
            currency: "usd",
            payment_method_types: ["card"],
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(500).json({ message: "Payment error", error });
    }
});

//পেমেন্ট সফল হলে "Paid" স্ট্যাটাস
app.put("/orders/pay/:id", async (req, res) => {
    const orderId = req.params.id;
    try {
        const result = await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { status: "Paid" } }
        );

        res.json({ message: "Payment Successful", updated: result.modifiedCount > 0 });
    } catch (error) {
        res.status(500).json({ message: "Failed to update payment status" });
    }
});


        // Add a new service
        app.post('/add-service', async (req, res) => {
            const name = req.body.name;
            const description = req.body.description;
            const pic = req.files.image;
            const picData = pic.data;
            const encodePic = picData.toString('base64');
            const imageBuffer = Buffer.from(encodePic, 'base64');
            const service = {
                name,
                des: description,
                image: imageBuffer,
            };
            const result = await serviceCollection.insertOne(service);
            res.send(result);
        });

        // Appointment options with available slots
        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            const query = {};
            const options = await appointmentOptionCollection.find(query).toArray();

            const bookingQuery = { appointmentDate: date };
            const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();

            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.serviceName === option.name);
                const bookedSlots = optionBooked.map(booked => booked.slot);
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot));
                option.slots = remainingSlots;
            });
            res.send(options);
        });

        // Get all bookings for a user
        app.get('/bookings', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings);
        });

        // Add a new booking
        app.post('/bookings', async (req, res) => {
            const bookings = req.body;
            const query = {
                appointmentDate: bookings.appointmentDate,
                email: bookings.email,
                serviceName: bookings.serviceName,
            };

            const alreadyBooked = await bookingCollection.find(query).toArray();
            if (alreadyBooked.length) {
                const message = `You already have a booking on ${bookings.appointmentDate}, Please try another day or service`;
                return res.send({ acknowledged: false, message });
            }
            const result = await bookingCollection.insertOne(bookings);
            res.send(result);
        });

        // Users management
        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user); 
            res.send(result);
        });

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        });

        // Admin management
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        });

        app.put('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const option = { upsert: true };
            const updatedDoc = {
                $set: { role: 'admin' },
            };
            const result = await usersCollection.updateOne(filter, updatedDoc, option);
            res.send(result);
        });

        // Products endpoint
        app.get('/api/products', async (req, res) => {
            const categoryId = req.query.category;

            if (!categoryId) {
                return res.status(400).send({ error: 'Category ID is required' });
            }

            try {
                const query = { categoryId: categoryId }; // Replace 'categoryId' with the actual field name in your collection
                const products = await serviceCollection.find(query).toArray();

                res.send({
                    success: true,
                    data: products.map(product => ({
                        id: product._id,
                        name: product.name,
                        location: product.location,
                        resalePrice: product.resalePrice,
                        originalPrice: product.originalPrice,
                        yearsOfUse: product.yearsOfUse,
                        postedTime: product.postedTime,
                        sellerName: product.sellerName,
                        isVerified: product.isVerified,
                        image: product.image, // Ensure this is a proper URL or Base64 string
                    })),
                });
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Failed to fetch products' });
            }
        });
    } finally {
        // await client.close();
    }
}

bootstrap().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello Ajker Bazar');
});

app.listen(port, () => {
    console.log(`Ajker Bazar app listening on port ${port}`);
});