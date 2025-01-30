const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const fileUpload = require('express-fileupload');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rvwdp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function bootstrap() {
    try {
        await client.connect();
        const database = client.db('online-embassy');
        const serviceCollection = database.collection('services');
        const usersCollection = database.collection('Users');
        const bookingCollection = database.collection('bookings');
        const appointmentOptionCollection = database.collection('appointmentOptions');

        // Get all services
        app.get('/all-services', async (req, res) => {
            const query = {};
            const result = await serviceCollection.find(query).toArray();
            res.send(result);
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
