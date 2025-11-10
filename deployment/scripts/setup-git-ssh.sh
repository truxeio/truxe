#!/bin/bash

# Setup SSH Key for Git Access
# Run this on your deployment server

set -e

echo "🔐 Git SSH Key Setup"
echo "===================="
echo ""

# Check if SSH key already exists
if [ -f ~/.ssh/id_ed25519 ]; then
    echo "✓ SSH key already exists"
    echo ""
    echo "Your public key:"
    cat ~/.ssh/id_ed25519.pub
    echo ""
    echo "📋 Copy the above key and add it to GitHub:"
    echo "   https://github.com/settings/ssh/new"
    echo ""
else
    echo "Generating new SSH key..."
    read -p "Enter your email: " email
    ssh-keygen -t ed25519 -C "$email" -f ~/.ssh/id_ed25519 -N ""
    echo ""
    echo "✓ SSH key generated"
    echo ""
fi

# Start ssh-agent and add key
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

echo "📋 Your public key (copy this to GitHub):"
echo "========================================"
cat ~/.ssh/id_ed25519.pub
echo "========================================"
echo ""
echo "Add this key to GitHub:"
echo "  1. Go to: https://github.com/settings/ssh/new"
echo "  2. Title: Deployment Server"
echo "  3. Paste the key above"
echo "  4. Click 'Add SSH key'"
echo ""

# Test GitHub connection
read -p "Press Enter after adding the key to GitHub..."
echo ""
echo "Testing GitHub connection..."
ssh -T git@github.com || true
echo ""

# Convert existing repo to SSH (if in a git repo)
if [ -d .git ]; then
    echo "Converting existing repository to SSH..."
    current_url=$(git remote get-url origin)
    echo "Current URL: $current_url"

    # Extract repo path from HTTPS URL
    if [[ $current_url == https://github.com/* ]]; then
        repo_path=$(echo $current_url | sed 's|https://github.com/||' | sed 's|\.git$||')
        ssh_url="git@github.com:${repo_path}.git"

        echo "New URL: $ssh_url"
        git remote set-url origin "$ssh_url"
        echo "✓ Repository converted to SSH"
    else
        echo "Repository already using SSH or not a GitHub repo"
    fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Now you can:"
echo "  git clone git@github.com:Wundam/Truxe.git"
echo "  git pull"
echo "  git push"
echo ""
