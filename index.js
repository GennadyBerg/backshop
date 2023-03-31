const jwtSecret   = 'AjnjLhjxM'
const jwt         = require('jsonwebtoken')

const express           = require('express');
const express_graphql   = require('express-graphql');

const { buildSchema, printSchema, GraphQLString } = require('graphql');
const expand = require('mm-graphql/expand')
const fs     = require('fs')
const uploadPath = `${__dirname}/public/images/`;
const upload  = require('multer')({ dest: uploadPath })


;(async () => {

    const {Savable, slice, getModels} = await require('./models.js')()
    const { jwtGQLAnon, jwtCheck } = require('mm-graphql/jwt')

    let schema = buildSchema(`
        type User {
             _id: String
             createdAt: String
             login: String
             nick : String
             avatar: Image
             acl: [String]
        }

        input UserInput {
             _id: String
             login: String
             nick : String
             password: String
             acl: [String]
             avatar: ImageInput
        }

        type Image {
            _id: ID,
            createdAt: String
            text: String,
            url: String,
            originalFileName: String,
            userAvatar: User,
            good: Good
            category: Category
            owner: User
        }

        input ImageInput {
            _id: ID,
            text: String,
            userAvatar: UserInput,
            good: GoodInput
            category: CategoryInput
        }

        type Category {
            _id: ID,
             createdAt: String
            name: String,
            goods: [Good]
            image: Image
            owner: User
            parent: Category
            subCategories: [Category]
        }

        input CategoryInput {
            _id: ID,
            name: String!,
            goods: [GoodInput]
            image: ImageInput

            parent: CategoryInput
            subCategories: [CategoryInput]
        }

        type Good {
            _id: ID,
            createdAt: String
            name: String,
            description: String
            price: Float
            orderGoods: [OrderGood]
            categories: [Category]
            images: [Image]
            owner: User
        }

        input GoodInput {
            _id: ID,
            name: String,
            description: String
            price: Float
            categories: [CategoryInput]
            images: [ImageInput]
        }

        type OrderGood {
            _id: ID,
            createdAt: String
            price: Float,
            count: Float,
            good: Good,
            order: Order
            owner: User
            total: Float
        }

        input OrderGoodInput {
            _id: ID,
            count: Int!,
            good: GoodInput,
            order: OrderInput
        }

        type Order {
            _id: ID
            createdAt: String
            total: Float
            orderGoods: [OrderGood]
            owner: User
        }

        input OrderInput {
            _id: ID
            orderGoods: [OrderGoodInput]
        }
    `);

    schema = expand(schema, {
        login:{
            type: GraphQLString,
            args: {login:    {type: GraphQLString},
                   password: {type: GraphQLString},
            },
            async resolve(root, {login, password}, context, info){
                const Savable =  context.models.Savable 
                if (!login || !password) return null;
                const user    =  await Savable.m.User.findOne({login, password})
                console.log(user, {login, password})
                if (!user)
                    return null;

                const token = jwt.sign({ sub: {id: user._id, login, acl: user.acl}}, jwtSecret); //подписывам токен нашим ключем
                return token
            }
        }
    })
    console.log(printSchema(schema))

    const app = express();
    app.use(require('cors')())
    app.use(express.static('public'));
    app.use('/graphql', express_graphql(jwtGQLAnon({schema, createContext: getModels, graphiql: true, secret: jwtSecret})))


    app.post('/upload', upload.single('photo'), async (req, res, next) => {
        let decoded;
        if (decoded = jwtCheck(req, jwtSecret)){
            console.log('SOME UPLOAD', decoded, req.file)

            let {models: {Image }} = await getModels(decoded.sub)
		if (req.file){
			let image = await Image.fromFileData(req.file)
			res.end(JSON.stringify({_id: image._id, url: image.url}))
		}
		else {
			res.end('дичь')
		}
        }
        else {
            res.status(503).send('permission denied')
        }
    })

    app.use(express.static('public'));


    let socketPath = 3030
    app.listen(socketPath, () => {
        console.log(`Express GraphQL Server Now Running On ${socketPath}/graphql`);
        //fs.chmodSync(socketPath, '777');
    });
})()

process.on('uncaughtException', (error) => {
	console.log('UNCAUGHT EXCEPTION', error)
})

