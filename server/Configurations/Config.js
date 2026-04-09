require("dotenv").config();

module.exports = {
  databaseUrl: process.env.DATABASE_URL,
  secretKey: process.env.SECRET_KEY,
  email: process.env.EMAIL,
  password: process.env.PASSWORD,

  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },

  // Google
  web: {
    client_id: process.env.GOOGLE_CLIENT_ID,
    project_id: process.env.GOOGLE_PROJECT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uris: process.env.GOOGLE_REDIRECT_URIS,
    javascript_origins: [process.env.GOOGLE_JAVASCRIPT_ORIGINS],
  },
};
