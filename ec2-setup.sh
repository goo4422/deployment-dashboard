#!/bin/bash
# ═══════════════════════════════════════════════════
# EC2 Ubuntu 22.04 — Jenkins + Docker Setup Script
# Нэг удаа ажиллуулна: bash ec2-setup.sh
# ═══════════════════════════════════════════════════

set -e
echo "🚀 EC2 Setup эхэлж байна..."

# ── 1. System update ────────────────────────────────
sudo apt-get update -y && sudo apt-get upgrade -y

# ── 2. Docker суулгах ───────────────────────────────
echo "🐳 Docker суулгаж байна..."
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Docker service эхлүүлнэ
sudo systemctl enable docker
sudo systemctl start docker

# ── 3. Docker Compose суулгах ───────────────────────
echo "📦 Docker Compose суулгаж байна..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# ── 4. Java суулгах (Jenkins-д хэрэгтэй) ──────────
echo "☕ Java суулгаж байна..."
sudo apt-get install -y fontconfig openjdk-17-jre

# ── 5. Jenkins суулгах ──────────────────────────────
echo "🔧 Jenkins суулгаж байна..."
sudo wget -O /usr/share/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/" | \
  sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y jenkins

# Jenkins service эхлүүлнэ
sudo systemctl enable jenkins
sudo systemctl start jenkins

# ── 6. Jenkins-г docker group-д нэмнэ ─────────────
sudo usermod -aG docker jenkins
sudo usermod -aG docker ubuntu

# ── 7. Node.js суулгах ──────────────────────────────
echo "🟢 Node.js суулгаж байна..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# ── 8. Firewall тохиргоо ────────────────────────────
echo "🔒 Firewall тохируулж байна..."
sudo ufw allow 22      # SSH
sudo ufw allow 8080    # Jenkins
sudo ufw allow 3000    # App
sudo ufw --force enable

# ── Дууслаа ─────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ EC2 Setup амжилттай дууслаа!             ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Jenkins : http://$(curl -s ifconfig.me):8080 "
echo "║  App     : http://$(curl -s ifconfig.me):3000 "
echo "╠══════════════════════════════════════════════╣"
echo "║  Jenkins initial password:                   ║"
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "⚠️  Jenkins дээр 'dockerhub-credentials' нэмэхээ бүү мартаарай!"
