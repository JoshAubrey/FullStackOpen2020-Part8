const { ApolloServer, UserInputError, AuthenticationError, gql } = require('apollo-server')
const { v1: uuid } = require('uuid')
const jwt = require('jsonwebtoken')

const { PubSub } = require('apollo-server')
const pubsub = new PubSub()

const mongoose = require('mongoose')
const Author = require('./models/author')
const Book = require('./models/book')
const User = require('./models/user')

const JWT_SECRET = 'SECRET_KEY'

const MONGODB_URI = 'mongodb+srv://fullstack:fullstack@fullstackopen.wbhnz.mongodb.net/library?retryWrites=true&w=majority'

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true })
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connection to MongoDB:', error.message)
  })

//mongoose.set('debug', true);

// let authors = [
//   {
//     name: 'Robert Martin',
//     id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
//     born: 1952,
//   },
//   {
//     name: 'Martin Fowler',
//     id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
//     born: 1963
//   },
//   {
//     name: 'Fyodor Dostoevsky',
//     id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
//     born: 1821
//   },
//   { 
//     name: 'Joshua Kerievsky', // birthyear not known
//     id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
//   },
//   { 
//     name: 'Sandi Metz', // birthyear not known
//     id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
//   },
// ]

/*
* It might make more sense to associate a book with its author by storing the author's name in the context of the book instead of the author's id
* However, for simplicity, we will store the author's name in connection with the book
*/

// let books = [
//   {
//     title: 'Clean Code',
//     published: 2008,
//     author: 'Robert Martin',
//     id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
//     genres: ['refactoring']
//   },
//   {
//     title: 'Agile software development',
//     published: 2002,
//     author: 'Robert Martin',
//     id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
//     genres: ['agile', 'patterns', 'design']
//   },
//   {
//     title: 'Refactoring, edition 2',
//     published: 2018,
//     author: 'Martin Fowler',
//     id: "afa5de00-344d-11e9-a414-719c6709cf3e",
//     genres: ['refactoring']
//   },
//   {
//     title: 'Refactoring to patterns',
//     published: 2008,
//     author: 'Joshua Kerievsky',
//     id: "afa5de01-344d-11e9-a414-719c6709cf3e",
//     genres: ['refactoring', 'patterns']
//   },  
//   {
//     title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
//     published: 2012,
//     author: 'Sandi Metz',
//     id: "afa5de02-344d-11e9-a414-719c6709cf3e",
//     genres: ['refactoring', 'design']
//   },
//   {
//     title: 'Crime and punishment',
//     published: 1866,
//     author: 'Fyodor Dostoevsky',
//     id: "afa5de03-344d-11e9-a414-719c6709cf3e",
//     genres: ['classic', 'crime']
//   },
//   {
//     title: 'The Demon ',
//     published: 1872,
//     author: 'Fyodor Dostoevsky',
//     id: "afa5de04-344d-11e9-a414-719c6709cf3e",
//     genres: ['classic', 'revolution']
//   },
// ]

const typeDefs = gql`
  type Author {
    name: String!
    id: ID!
    born: Int
    bookCount: Int
    books: [Book!]
  }

  type Book {
    title: String!
    published: Int!
    author: Author!
    id: ID!
    genres: [String!]!
  }

  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }

  type Token {
    value: String!
  }  

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
    me: User
  }
  
  type Mutation {
    addBook(
      title: String!
      published: Int!
      author: String!
      genres: [String!]!
    ): Book

    editAuthor(
      name: String!
      setBornTo: Int!
    ): Author

    createUser(
      username: String!
      favoriteGenre: String!
    ): User
    
    login(
      username: String!
      password: String!
    ): Token
  }

  type Subscription {
    bookAdded: Book!
  }  
`

const resolvers = {
  Query: {
    bookCount: () => Book.collection.countDocuments(), //books.length,
    authorCount: () => Author.collection.countDocuments(), //authors.length,
    allBooks: async (root, args) => (
      // (args.author && args.genre) ? books.filter(b => (b.author === args.author && b.genres.includes(args.genre)))
      // : args.author ? books.filter(b => b.author === args.author) 
      // : args.genre ? books.filter(b => b.genres.includes(args.genre)) 
      // : books
      (args.author && args.genre) ? await Book.find( {$and: [ {'author': {$eq: await Author.findOne({ name: args.author })}}, {genres: {$in: [args.genre]}} ]} ).populate('author')
      : args.author ? await Book.find( {'author': {$eq: await Author.findOne({ name: args.author })}} ).populate('author')
      : args.genre ? await Book.find( {genres: {$in: [args.genre]}} ).populate('author')
      : await Book.find({}).populate('author')
    ),
    //allAuthors: () => authors
    allAuthors: () => Author.find({}).populate('books'),
    me: (root, args, context) => context.currentUser
  },
  Author: {
    //bookCount: (root) => books.filter(b => b.author === root.name).length
    //bookCount: (root) => Book.find({ author: root }).countDocuments() //n+1 problem
    bookCount: (root) => root.books.length
  },
  Mutation: {
    addBook: async (root, args, context) => {
      // const book = { ...args, id: uuid() }
      // books = books.concat(book)
      // if ( !(authors.some(a => a.name === args.author)) ){
      //   const author = { name: args.author, id: uuid() }
      //   authors = authors.concat(author)
      // }
      // return book

      const currentUser = context.currentUser
      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      const author = await Author.findOne( { name: {$eq: args.author}} )
      let book = new Book({ ...args })

      if ( !(author) ){
        const newAuthor = new Author({ name: args.author, books: [ book.id ] })
        book.author = newAuthor
        try {
          await newAuthor.save()
        } catch (error) {
          throw new UserInputError(error.message, { invalidArgs: args })
        }
        //const book = new Book({ ...args, 'author': newAuthor })
        try {
          await book.save()
        } catch (error) {
          throw new UserInputError(error.message, { invalidArgs: args })
        }

        pubsub.publish('BOOK_ADDED', { bookAdded: book })
        return book
      }

      //const book = new Book({ ...args, author: author })
      book.author = author
      author.books = author.books.concat(book.id)
      try {
        await book.save()
        await author.save()
      } catch (error) {
        throw new UserInputError(error.message, { invalidArgs: args })
      }
      pubsub.publish('BOOK_ADDED', { bookAdded: book })
      return book

    },
    editAuthor: async (root, args, context) => {
      const currentUser = context.currentUser
      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      const author = await Author.findOne({name: args.name})
      author.born = args.setBornTo
      return author.save()
    },
    // editAuthor: (root, args) => {
    //   const author = authors.find(a => a.name === args.name)
    //   if (!author) return null
      
    //   const updatedAuthor = { ...author, born: args.setBornTo }
    //   authors = authors.map(a => a.name === args.name ? updatedAuthor : a)
    //   return updatedAuthor
    // }
    createUser: (root, args) => {
      //const user = new User({ username: args.username })
      const user = new User({ username: args.username, favoriteGenre: args.favoriteGenre })

      return user.save()
        .catch(error => {
          throw new UserInputError(error.message, { invalidArgs: args })
        })
    }, 
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username })
  
      if ( !user || args.password !== 'secret' ) {
        throw new UserInputError("wrong credentials")
      }
  
      const userForToken = {
        username: user.username,
        id: user._id,
      }
  
      return { value: jwt.sign(userForToken, JWT_SECRET) }
    },
  },
  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator(['BOOK_ADDED'])
    }
  },
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), JWT_SECRET
      )
      const currentUser = await User
        .findById(decodedToken.id)
      return { currentUser }
    }
  }
})

server.listen().then(({ url, subscriptionsUrl }) => {
  console.log(`Server ready at ${url}`)
  console.log(`Subscriptions ready at ${subscriptionsUrl}`)
})