require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId} = require('mongodb');
const express = require('express')
const cors = require('cors')
// const jwt = require('jsonwebtoken')
// const cookieParser = require('cookie-parser')
const app = express()
const port = process.env.PORT || 3000
app.use(cors())
// app.use(cookieParser())
app.use(express.json())

var admin = require("firebase-admin");

var serviceAccount = require("./firebaseKeyAdmin.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// const verifyToken = (req, res, next) => {
//     const token = req?.cookies?.token
//     // console.log(token)
//     if (!token) {
//         return res.status(401).send({
//             message: 'unauthorized'
//         })
//     }
//     jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
//         if (error) {
//             return res.status(401).send({
//                 message: 'unauthorized'
//             })
//         }
//         req.decoded = decoded
//         // console.log(decoded)
//         next()
//     })
// }

const verifyFirebaseToken = async (req, res, next) => {
    const authHeader = req?.headers?.authorization;
    // console.log(authHeader)
    const token = authHeader.split(' ')[1];
    // console.log(token)

    if (!token) {
        return res.status(401).send({ message: 'unauthorized' });
    }
    const userInfo = await admin.auth().verifyIdToken(token);
    req.tokenEmail = userInfo?.email;
    next();
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.SECURITY_KEY}@careerdev.6rwjfy7.mongodb.net/?retryWrites=true&w=majority&appName=careerDev`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const jobsCollection = client.db('careerDev').collection('jobs')
        const applicationsCollection = client.db('careerDev').collection('applications')

        // app.post('/jwt', async (req, res) => {
        //     const {email} = req.body
        //     const user = {email}
        //     const token = jwt.sign(user, process.env.JWT_SECRET, {
        //         expiresIn: '2d'
        //     })
        //     res.cookie('token', token, {
        //         httpOnly: true,
        //         secure: false
        //     })
        //     res.send({success: true})
        // })
        
        app.get('/jobs', async (req, res) => {
            const query = {}
            if (req.query.email) {
                query.hr_email = req.query.email
            }
            const result = await jobsCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/jobs/applications', async (req, res) => {
            const jobs = await jobsCollection.find({
                hr_email: req.query.email
            }).toArray()

            for (const job of jobs) {
                const application_count = await applicationsCollection.countDocuments({
                    jobId: job._id.toString()
                })
                job.application_count = application_count
            }
            res.send(jobs)
        })



        app.get('/jobs/:id', async (req, res) => {
            const query = {
                _id: new ObjectId(req.params.id)
            }
            const result = await jobsCollection.findOne(query)
            res.send(result)
        })

        app.post('/jobs', async (req, res) => {
            const result = await jobsCollection.insertOne(req.body)
            res.send(result)
        })

        app.get('/applications', verifyFirebaseToken, async (req, res) => {

            const {email} = req.query
            // console.log(email, req?.decoded?.email)

            if (req.tokenEmail !== email) {
                return res.status(403).send({
                    message: 'forbidden'
                })
            }

            const query = {
                applicant: email
            }
            const result = await applicationsCollection.find(query).toArray()

            for (const application of result) {
                const jobQuery = {
                 _id: new ObjectId(application.jobId)
                }
                const job = await jobsCollection.findOne(jobQuery)
                application.company = job.company
                application.title = job.title
                application.company_logo = job.company_logo

            }
            res.send(result)
        })

        app.get('/applications/job/:job_id', async (req, res) => {
            const query = {
                jobId: req.params.job_id
            }
            const result = await applicationsCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/applications', async (req, res) => {
            const result = await applicationsCollection.insertOne(req.body)
            res.send(result)
        })

        app.patch('/applications/:id', async (req, res) => {
            const filter = {
                _id: new ObjectId(req.params.id)
            }
            const update = {
                $set: {
                    status: req.body.status
                }
            }
            const result = await applicationsCollection.updateOne(filter, update)
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error

    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`server ${port}`)
})