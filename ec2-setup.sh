#!/bin/bash
# ═══════════════════════════════════════════════════
# EC2 Ubuntu 22.04 — Jenkins + Docker Setup Script
# Нэг удаа ажиллуулна: bash ec2-setup.sh
# ═══════════════════════════════════════════════════

set -euo pipefail

log() { echo "[$(date '+%H:%M:%S')] $*"; }
log "EC2 Setup эхэлж байна..."

# ── 1. System update ────────────────────────────────
log "System шинэчилж байна..."
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git ufw

# ── 2. Swap space (t2.micro/t3.micro-д зайлшгүй) ──
log "Swap space тохируулж байна (2GB)..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    log "Swap: $(free -h | grep Swap)"
else
    log "Swap аль хэдийн тохируулагдсан байна."
fi

# ── 3. Docker суулгах ───────────────────────────────
log "Docker суулгаж байна..."
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable docker && sudo systemctl start docker
log "Docker: $(docker --version)"

# ── 4. Docker Compose суулгах ───────────────────────
log "Docker Compose суулгаж байна..."
sudo curl -sL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
log "Docker Compose: $(docker-compose --version)"

# ── 5. Java суулгах ─────────────────────────────────
log "Java суулгаж байна..."
sudo apt-get install -y fontconfig openjdk-17-jre
log "Java: $(java -version 2>&1 | head -1)"

# ── 6. Jenkins суулгах ──────────────────────────────
log "Jenkins суулгаж байна..."
sudo wget -qO /usr/share/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/" | \
  sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null

sudo apt-get update -y && sudo apt-get install -y jenkins
sudo systemctl enable jenkins && sudo systemctl start jenkins
log "Jenkins: $(jenkins --version 2>/dev/null || echo 'started')"

# ── 7. Хэрэглэгчдийн group тохиргоо ────────────────
sudo usermod -aG docker jenkins
sudo usermod -aG docker ubuntu

# ── 8. Node.js суулгах ──────────────────────────────
log "Node.js 20 суулгаж байна..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
log "Node.js: $(node --version) | npm: $(npm --version)"

# ── 9. Fail2ban (brute-force хамгаалалт) ───────────
log "Fail2ban суулгаж байна..."
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban && sudo systemctl start fail2ban
log "Fail2ban: идэвхжсэн"

# ── 10. Firewall тохиргоо ───────────────────────────
log "Firewall тохируулж байна..."
sudo ufw allow 22      # SSH
sudo ufw allow 80      # Nginx (HTTP)
sudo ufw allow 8080    # Jenkins
sudo ufw allow 3000    # App (шууд хандах бол)
sudo ufw --force enable
log "Firewall: $(sudo ufw status | head -1)"

# ── Баталгаажуулалт ─────────────────────────────────
log "Суулгалтыг баталгаажуулж байна..."
PUBLIC_IP=$(curl -sf ifconfig.me || echo "IP авч чадсангүй")

echo ""
echo "+====================================================+"
echo "|  EC2 Setup амжилттай дууслаа!                     |"
echo "+====================================================+"
echo "|  Jenkins  : http://${PUBLIC_IP}:8080"
echo "|  App      : http://${PUBLIC_IP}:80  (nginx)"
echo "|  App      : http://${PUBLIC_IP}:3000 (шууд)"
echo "+====================================================+"
echo "|  Swap     : $(free -h | grep Swap | awk '{print $2}')"
echo "|  Docker   : $(docker --version | cut -d' ' -f3 | tr -d ',')"
echo "|  Node.js  : $(node --version)"
echo "+====================================================+"
echo "|  Jenkins initial password:"
sudo cat /var/lib/jenkins/secrets/initialAdminPassword 2>/dev/null || echo "  (Jenkins эхлэхийг хүлээгээрэй)"
echo "+====================================================+"
echo ""
echo "  Анхаарах: Jenkins дээр 'dockerhub-credentials'"
echo "  болон 'ec2-ssh' credentials нэмэхээ бүү мартаарай!"
