document.addEventListener('DOMContentLoaded', () => {
    const toolbar = document.getElementById('toolbar');
    const petriDish = document.getElementById('petriDish');
    const clearButton = document.getElementById('clearButton');
    const microbeDisplays = {
        total: document.getElementById('totalMicrobes'),
        predator: document.getElementById('predatorMicrobes'),
        virus: document.getElementById('virusMicrobes'),
        prey: document.getElementById('preyMicrobes'),
        reproducer: document.getElementById('reproducerMicrobes')
    };

    let selectedMicrobeType = null;
    let lifespans = new Map();
    let reproductionCount = new Map();

    toolbar.addEventListener('click', selectMicrobe);
    petriDish.addEventListener('click', placeMicrobe);
    clearButton.addEventListener('click', clearAllMicrobes);

    function selectMicrobe(event) {
        if (event.target.classList.contains('microbe')) {
            selectedMicrobeType = event.target.id;
            toolbar.querySelectorAll('.microbe').forEach(microbe => microbe.classList.remove('selected'));
            event.target.classList.add('selected');
        }
    }

    function placeMicrobe(event) {
        if (!selectedMicrobeType) return;
        const microbe = document.getElementById(selectedMicrobeType).cloneNode(true);
        microbe.classList.replace('microbe', 'dish-microbe');
        microbe.style.left = `${event.clientX - petriDish.offsetLeft - 10}px`;
        microbe.style.top = `${event.clientY - petriDish.offsetTop}px`;
        microbe.setAttribute('draggable', false);
        petriDish.appendChild(microbe);
        addBehavior(microbe);
        startLifespanTimer(microbe);
        updateMicrobeStatistics();
    }

    function clearAllMicrobes() {
        document.querySelectorAll('.dish-microbe').forEach(microbe => microbe.remove());
        lifespans.forEach((_, interval) => clearInterval(interval));
        lifespans.clear();
        reproductionCount.clear();
        updateMicrobeStatistics();
    }

    function addBehavior(microbe) {
        microbe.dataset.type = microbe.id;
        const interval = setInterval(() => {
            switch (microbe.id) {
                case 'predator':
                    seekTarget(microbe);
                    checkCollision(microbe);
                    break;
                case 'virus':
                    seekTarget(microbe);
                    checkCollision(microbe);
                    break;
                case 'prey':
                    moveMicrobeToRandomTarget(microbe);
                    break;
                case 'reproducer':
                    toggleReproductiveState(microbe);
                    break;
            }
            updateMicrobeStatistics();
        }, 1000);
        lifespans.set(interval, microbe);
        if (microbe.id === 'reproducer') reproductionCount.set(microbe, 0);
    }

    function seekTarget(microbe) {
        const type = microbe.dataset.type;
        let targetType, excludeType;

        if (type === 'predator') {
            targetType = ['prey', 'virus', 'reproducer'];
            excludeType = 'predator';
        } else if (type === 'virus') {
            targetType = ['prey', 'reproducer'];
            excludeType = 'virus';
        } else if (type === 'prey') {
            targetType = ['predator'];
            excludeType = 'prey';
        } else if (type === 'reproducer') {
            targetType = ['prey', 'virus'];
            excludeType = 'reproducer';
        } else {
            return;
        }

        const targets = Array
            .from(petriDish.querySelectorAll('.dish-microbe'))
            .filter(c => targetType.includes(c.dataset.type) && c.dataset.type !== excludeType);

        if (targets.length === 0) return;

        const closestTarget = targets.reduce((closest, target) => {
            const dist = distance(microbe, target);
            return dist < distance(microbe, closest) ? target : closest;
        });
        moveToTarget(microbe, closestTarget);
    }

    function moveToTarget(microbe, target) {
        const newX = parseFloat(target.style.left);
        const newY = parseFloat(target.style.top);
        const duration = 7;

        microbe.style.transition = `left ${duration}s linear, top ${duration}s linear`;
        microbe.style.left = `${Math.min(Math.max(newX, 0), petriDish.clientWidth - microbe.clientWidth)}px`;
        microbe.style.top = `${Math.min(Math.max(newY, 0), petriDish.clientHeight - microbe.clientHeight)}px`;
    }

    function toggleReproductiveState(microbe) {
        if (Math.random() < 0.075) {
            reproduceMicrobe(microbe);
        } else {
            moveMicrobeToRandomTarget(microbe);
        }
    }

    function moveMicrobeToRandomTarget(microbe) {
        const dishWidth = petriDish.clientWidth - microbe.clientWidth;
        const dishHeight = petriDish.clientHeight - microbe.clientHeight;

        const targetX = Math.random() * dishWidth;
        const targetY = Math.random() * dishHeight;

        const move = () => {
            const currentX = parseFloat(microbe.style.left);
            const currentY = parseFloat(microbe.style.top);
            const angle = Math.atan2(targetY - currentY, targetX - currentX);
            const distance = Math.hypot(targetX - currentX, targetY - currentY);
            const stepSize = Math.min(distance, 1);

            const newX = currentX + stepSize * Math.cos(angle);
            const newY = currentY + stepSize * Math.sin(angle);

            microbe.style.left = `${Math.min(Math.max(newX, 0), dishWidth)}px`;
            microbe.style.top = `${Math.min(Math.max(newY, 0), dishHeight)}px`;

            if (Math.abs(newX - targetX) < 1 && Math.abs(newY - targetY) < 1) {
                moveMicrobeToRandomTarget(microbe);
                return;
            }
            requestAnimationFrame(move);
        };
        move();
    }

    function reproduceMicrobe(microbe) {
        const currentCount = reproductionCount.get(microbe) || 0;
        if (petriDish.contains(microbe)
            && petriDish.querySelectorAll('.dish-microbe').length < 99
            && currentCount < 2) {
            const newMicrobe = microbe.cloneNode(true);
            newMicrobe.style.left = microbe.style.left;
            newMicrobe.style.top = microbe.style.top;
            petriDish.appendChild(newMicrobe);
            addBehavior(newMicrobe);
            startLifespanTimer(newMicrobe);
            reproductionCount.set(microbe, currentCount + 1);
            if (currentCount + 1 === 2) {
                microbe.remove();
                stopReproduction(microbe);
            }
        }
    }

    function checkCollision(microbe) {
        const microbeRect = microbe.getBoundingClientRect();
        const type = microbe.dataset.type;

        petriDish.querySelectorAll('.dish-microbe').forEach(otherMicrobe => {
            const otherType = otherMicrobe.dataset.type;

            if (type === 'predator' && (otherType === 'prey' || otherType === 'reproducer')) {
                if (isCollision(microbeRect, otherMicrobe.getBoundingClientRect())) {
                    handleCollision(microbe, otherMicrobe);
                }
            } else if (type === 'virus' && otherType !== 'virus') {
                if (isCollision(microbeRect, otherMicrobe.getBoundingClientRect())) {
                    handleCollision(microbe, otherMicrobe);
                }
            } else if (type === 'prey' && otherType === 'predator') {
                if (isCollision(microbeRect, otherMicrobe.getBoundingClientRect())) {
                    handleCollision(microbe, otherMicrobe);
                }
            } else if (type === 'reproducer' && (otherType === 'predator' || otherType === 'virus')) {
                if (isCollision(microbeRect, otherMicrobe.getBoundingClientRect())) {
                    handleCollision(microbe, otherMicrobe);
                }
            }
        });
    }

    function isCollision(rect1, rect2) {
        return rect1.left < rect2.left + rect2.width &&
            rect1.left + rect1.width > rect2.left &&
            rect1.top < rect2.top + rect2.height &&
            rect1.top + rect1.height > rect2.top;
    }

    function handleCollision(microbe, otherMicrobe) {
        if (microbe.dataset.type === 'predator' && otherMicrobe.dataset.type !== 'virus') {
            otherMicrobe.remove();
            stopReproduction(otherMicrobe);
            growPredator(microbe);
            updateMicrobeStatistics();
        } else if (microbe.dataset.type === 'virus' && otherMicrobe.dataset.type !== 'virus') {
            const collisionX = parseFloat(otherMicrobe.style.left);
            const collisionY = parseFloat(otherMicrobe.style.top);
            spawnVirusAtPosition(collisionX, collisionY);
            otherMicrobe.remove();
            stopReproduction(otherMicrobe);
            updateMicrobeStatistics();
        }
    }

    function spawnVirusAtPosition(x, y) {
        const virus = document.querySelector('.dish-microbe[data-type="virus"]').cloneNode(true);
        virus.classList.add('dish-microbe');
        virus.dataset.type = 'virus';

        const posX = Math.max(0, Math.min(petriDish.clientWidth - virus.clientWidth, x));
        const posY = Math.max(0, Math.min(petriDish.clientHeight - virus.clientHeight, y));

        virus.style.left = `${posX}px`;
        virus.style.top = `${posY}px`;
        virus.style.backgroundColor = 'orange';

        petriDish.appendChild(virus);
        addBehavior(virus);
        startLifespanTimer(virus);
    }

    function growPredator(predator) {
        const currentSize = parseInt(predator.style.width, 10) || 20;
        const newSize = Math.min(currentSize + 2, 50);
        predator.style.width = `${newSize}px`;
        predator.style.height = `${newSize}px`;
    }

    function distance(microbe1, microbe2) {
        const x1 = parseFloat(microbe1.style.left);
        const y1 = parseFloat(microbe1.style.top);
        const x2 = parseFloat(microbe2.style.left);
        const y2 = parseFloat(microbe2.style.top);
        return Math.hypot(x2 - x1, y2 - y1);
    }

    function startLifespanTimer(microbe) {
        const lifespanDuration = 30 * 1000;
        const interval = setInterval(() => {
            console.log(`Lifespan expired for ${microbe.id}`);
            
            microbe.remove();
            stopReproduction(microbe);
            clearInterval(interval);
            lifespans.delete(interval);
            updateMicrobeStatistics();
        }, lifespanDuration);
        lifespans.set(interval, microbe);
    }
    

    function stopReproduction(microbe) {
        const interval = [...lifespans.keys()].find(key => lifespans.get(key) === microbe);
        if (interval) {
            clearInterval(interval);
            lifespans.delete(interval);
        }
    }

    function updateMicrobeStatistics() {
        const totalMicrobes = petriDish.querySelectorAll('.dish-microbe').length;
        microbeDisplays.total.textContent = `Total Microbes: ${totalMicrobes}`;
    
        const labels = {
            predator: 'PRD',
            virus: 'VRX',
            prey: 'PRY',
            reproducer: 'REP'
        };
    
        for (let type in microbeDisplays) {
            if (type !== 'total') {
                const count = petriDish.querySelectorAll(`.dish-microbe[data-type="${type}"]`).length;
                microbeDisplays[type].textContent = `${labels[type]}: ${count}`;
            }
        }
    }    
});
