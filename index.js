const { ApolloServer, gql } = require('apollo-server')
const { v1: uuid } = require('uuid')

let authors = [
  {
    name: 'Robert Martin',
    id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
    born: 1952,
  },
  {
    name: 'Martin Fowler',
    id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
    born: 1963
  },
  {
    name: 'Fyodor Dostoevsky',
    id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
    born: 1821
  },
  { 
    name: 'Joshua Kerievsky', // birthyear not known
    id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
  },
  { 
    name: 'Sandi Metz', // birthyear not known
    id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
  },
]

/*
* It might make more sense to associate a book with its author by storing the author's name in the context of the book instead of the author's id
* However, for simplicity, we will store the author's name in connection with the book
*/

let books = [
  {
    title: 'Clean Code',
    published: 2008,
    author: 'Robert Martin',
    id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring']
  },
  {
    title: 'Agile software development',
    published: 2002,
    author: 'Robert Martin',
    id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
    genres: ['agile', 'patterns', 'design']
  },
  {
    title: 'Refactoring, edition 2',
    published: 2018,
    author: 'Martin Fowler',
    id: "afa5de00-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring']
  },
  {
    title: 'Refactoring to patterns',
    published: 2008,
    author: 'Joshua Kerievsky',
    id: "afa5de01-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring', 'patterns']
  },  
  {
    title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
    published: 2012,
    author: 'Sandi Metz',
    id: "afa5de02-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring', 'design']
  },
  {
    title: 'Crime and punishment',
    published: 1866,
    author: 'Fyodor Dostoevsky',
    id: "afa5de03-344d-11e9-a414-719c6709cf3e",
    genres: ['classic', 'crime']
  },
  {
    title: 'The Demon ',
    published: 1872,
    author: 'Fyodor Dostoevsky',
    id: "afa5de04-344d-11e9-a414-719c6709cf3e",
    genres: ['classic', 'revolution']
  },
]

const typeDefs = gql`
  type Author {
    name: String!
    id: ID!
    born: Int
    bookCount: Int
  }

  type Book {
    title: String!
    published: Int!
    author: String!
    id: ID!
    genres: [String!]!
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
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
  }
`

const resolvers = {
  Query: {
    bookCount: () => books.length,
    authorCount: () => authors.length,
    allBooks: (root, args) => (
      (args.author && args.genre) ? books.filter(b => (b.author === args.author && b.genres.includes(args.genre)))
      : args.author ? books.filter(b => b.author === args.author) 
      : args.genre ? books.filter(b => b.genres.includes(args.genre)) 
      : books
    ),
    allAuthors: () => authors
  },
  Author: {
    bookCount: (root) => books.filter(b => b.author === root.name).length
  },
  Mutation: {
    addBook: (root, args) => {
      const book = { ...args, id: uuid() }
      books = books.concat(book)
      if ( !(authors.some(a => a.name === args.author)) ){
        const author = { name: args.author, id: uuid() }
        authors = authors.concat(author)
      }
      return book
    },
    editAuthor: (root, args) => {
      const author = authors.find(a => a.name === args.name)
      if (!author) return null
      
      const updatedAuthor = { ...author, born: args.setBornTo }
      authors = authors.map(a => a.name === args.name ? updatedAuthor : a)
      return updatedAuthor
    }

  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})

//npm run dev
//http://localhost:4000/graphql

// query counts {
//   bookCount
//   authorCount
// }
// query allBooks {
//   allBooks {
//     title
//     author
//     published
//     genres
//   }
// }
// query allBooksAuthorRobert {
//   allBooks(author: "Robert Martin") {
//     title
//   }
// }
// query allBooksGenreRefactoring {
//   allBooks(genre: "refactoring") {
//     title
//     author
//   }
// }
// query allBooksAuthorRobertGenreRefactoring {
//   allBooks(author: "Robert Martin", genre: "refactoring") {
//     title
//     author
//   }
// }
// query allAuthors {
//   allAuthors {
//     name
//     born
//     bookCount
//   }
// }

// mutation addBookNoSQL {
//   addBook(
//     title: "NoSQL Distilled"
//     author: "Martin Fowler"
//     published: 2012
//     genres: ["database", "nosql"]
//   ) {
//     title
//     author
//   }
// }

// mutation addBookNewAuthorReijo {
//   addBook(
//     title: "Pimeyden tango"
//     author: "Reijo Mäki"
//     published: 1997
//     genres: ["crime"]
//   ) {
//     title
//     author
//   }
// }

// mutation editAuthorReijoBorn {
//   editAuthor(name: "Reijo Mäki", setBornTo: 1958) {
//     name
//     born
//   }
// }
