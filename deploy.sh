#!/bin/bash

# Conversational Search System - Free Deployment Script
# This script helps deploy the project to various free hosting platforms

echo "🚀 Conversational Search System - Deployment Script"
echo "=================================================="

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit - Conversational Search System"
    git branch -M main
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
fi

# Function to display platform options
show_platforms() {
    echo ""
    echo "🎯 Choose your hosting platform:"
    echo "1) Vercel (Recommended - Easiest)"
    echo "2) Netlify (Static sites with functions)"
    echo "3) Railway (Full-stack with database)"
    echo "4) Render (Full-stack apps)"
    echo "5) Fly.io (Global deployment)"
    echo "6) Exit"
    echo ""
    read -p "Enter your choice (1-6): " choice
}

# Function to check dependencies
check_dependencies() {
    echo "🔍 Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check git
    if ! command -v git &> /dev/null; then
        echo "❌ git is not installed. Please install git first."
        exit 1
    fi
    
    echo "✅ All dependencies are installed"
}

# Function to build the project
build_project() {
    echo "🔨 Building the project..."
    npm run build
    if [ $? -eq 0 ]; then
        echo "✅ Build successful"
    else
        echo "❌ Build failed. Please check the errors above."
        exit 1
    fi
}

# Function to setup Vercel deployment
setup_vercel() {
    echo "🌐 Setting up Vercel deployment..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        echo "📦 Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    echo ""
    echo "📋 Vercel Deployment Steps:"
    echo "1. Go to https://vercel.com"
    echo "2. Sign up with your GitHub account"
    echo "3. Click 'New Project'"
    echo "4. Select your GitHub repository"
    echo "5. Click 'Deploy'"
    echo ""
    echo "🔧 Environment Variables to add in Vercel dashboard:"
    echo "- NODE_ENV=production"
    echo "- NEXT_TELEMETRY_DISABLED=1"
    echo ""
    echo "📝 After deployment, your app will be available at: https://your-project.vercel.app"
    
    read -p "Press Enter to continue..."
}

# Function to setup Netlify deployment
setup_netlify() {
    echo "🌐 Setting up Netlify deployment..."
    
    # Check if Netlify CLI is installed
    if ! command -v netlify &> /dev/null; then
        echo "📦 Installing Netlify CLI..."
        npm install -g netlify-cli
    fi
    
    # Create netlify.toml
    cat > netlify.toml << 'EOF'
[build]
  command = "npm run build"
  publish = ".next"

[functions]
  directory = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
EOF
    
    echo "✅ Created netlify.toml configuration"
    
    echo ""
    echo "📋 Netlify Deployment Steps:"
    echo "1. Go to https://netlify.com"
    echo "2. Sign up and drag-and-drop your project folder"
    echo "3. OR connect to GitHub repository"
    echo "4. Configure build settings"
    echo ""
    echo "🔧 Note: API routes will be converted to serverless functions"
    
    read -p "Press Enter to continue..."
}

# Function to setup Railway deployment
setup_railway() {
    echo "🌐 Setting up Railway deployment..."
    
    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
        echo "📦 Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    echo ""
    echo "📋 Railway Deployment Steps:"
    echo "1. Install Railway CLI: npm install -g @railway/cli"
    echo "2. Login: railway login"
    echo "3. Initialize project: railway init"
    echo "4. Deploy: railway up"
    echo ""
    echo "🔧 Railway provides free PostgreSQL database"
    echo "💰 Free tier: $5/month credit"
    
    read -p "Press Enter to continue..."
}

# Function to setup Render deployment
setup_render() {
    echo "🌐 Setting up Render deployment..."
    
    echo ""
    echo "📋 Render Deployment Steps:"
    echo "1. Push your code to GitHub"
    echo "2. Go to https://render.com"
    echo "3. Sign up with GitHub"
    echo "4. Click 'New +' → 'Web Service'"
    echo "5. Connect your GitHub repository"
    echo "6. Select Node.js environment"
    echo "7. Set build command: npm run build"
    echo "8. Set start command: npm start"
    echo ""
    echo "🔧 Render provides free SSL certificate"
    echo "💰 Free tier: 750 hours/month"
    
    read -p "Press Enter to continue..."
}

# Function to setup Fly.io deployment
setup_flyio() {
    echo "🌐 Setting up Fly.io deployment..."
    
    # Check if Fly CLI is installed
    if ! command -v flyctl &> /dev/null; then
        echo "📦 Installing Fly CLI..."
        curl -L https://fly.io/install.sh | sh
    fi
    
    # Create Dockerfile
    cat > Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
EOF
    
    echo "✅ Created Dockerfile"
    
    echo ""
    echo "📋 Fly.io Deployment Steps:"
    echo "1. Install Fly CLI: curl -L https://fly.io/install.sh | sh"
    echo "2. Login: flyctl auth login"
    echo "3. Deploy: flyctl launch"
    echo ""
    echo "🔧 Fly.io provides global deployment"
    echo "💰 Free tier: 3 VMs, 3GB storage"
    
    read -p "Press Enter to continue..."
}

# Function to create GitHub repository
create_github_repo() {
    echo ""
    read -p "Do you want to create a GitHub repository? (y/n): " create_repo
    
    if [ "$create_repo" = "y" ] || [ "$create_repo" = "Y" ]; then
        echo "📝 To create a GitHub repository:"
        echo "1. Go to https://github.com"
        echo "2. Click 'New repository'"
        echo "3. Enter repository name"
        echo "4. Click 'Create repository'"
        echo "5. Copy the repository URL"
        echo ""
        read -p "Press Enter after creating the repository..."
        
        read -p "Enter your GitHub repository URL: " repo_url
        
        if [ ! -z "$repo_url" ]; then
            git remote add origin "$repo_url"
            git push -u origin main
            echo "✅ Code pushed to GitHub"
        fi
    fi
}

# Function to show post-deployment checklist
show_checklist() {
    echo ""
    echo "🎉 Deployment Setup Complete!"
    echo "=========================="
    echo ""
    echo "📋 Post-Deployment Checklist:"
    echo "✅ Project built successfully"
    echo "✅ Git repository initialized"
    echo "⏳ Platform-specific setup completed"
    echo ""
    echo "🔧 Next Steps:"
    echo "1. Complete platform-specific deployment"
    echo "2. Set up environment variables"
    echo "3. Test all features"
    echo "4. Configure custom domain (optional)"
    echo "5. Set up monitoring"
    echo ""
    echo "📚 Important Notes:"
    echo "- Free tiers have usage limits"
    echo "- Monitor your usage regularly"
    echo "- Implement caching for better performance"
    echo "- Use CDN for static assets when possible"
    echo ""
    echo "🚀 Your conversational search system is ready for deployment!"
}

# Main script execution
main() {
    check_dependencies
    build_project
    
    while true; do
        show_platforms
        
        case $choice in
            1)
                setup_vercel
                break
                ;;
            2)
                setup_netlify
                break
                ;;
            3)
                setup_railway
                break
                ;;
            4)
                setup_render
                break
                ;;
            5)
                setup_flyio
                break
                ;;
            6)
                echo "👋 Exiting..."
                exit 0
                ;;
            *)
                echo "❌ Invalid choice. Please try again."
                ;;
        esac
    done
    
    create_github_repo
    show_checklist
}

# Run main function
main