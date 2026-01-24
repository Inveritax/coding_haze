FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start Vite dev server (accessible from outside container on port 5173)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
