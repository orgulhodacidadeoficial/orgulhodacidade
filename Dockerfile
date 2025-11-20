FROM node:18-slim

# Create app directory
WORKDIR /app

# Install dependencies based on package.json
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Execute explicitamente o servidor dentro da pasta `backend`
# O projeto tem o servidor em `backend/server.js`, não em `/app/server.js`.
CMD ["npm", "start"]
