class Disk {
    constructor(size) {
        this.size = size;
        this.element = null;
    }

    createDiskElement() {
        const disk = document.createElement('div');
        disk.className = `disk size-${this.size}`;
        disk.dataset.size = this.size;
        disk.style.width = `${40 + (this.size-1) * 20}px`;
        disk.textContent = this.size;
        disk.setAttribute('draggable', true);
        disk.addEventListener('dragstart', this.handleDragStart);
        
        this.element = disk;
        return disk;
    }

    handleDragStart(e) {
        if (window.game.solving) return;
        
        const tower = e.target.parentElement;
        const towerIndex = parseInt(tower.dataset.index);
        const topDiskElement = tower.lastChild;
        
        // Only allow dragging the top disk
        if (e.target !== topDiskElement) {
            e.preventDefault();
            return;
        }
        
        e.dataTransfer.setData('text/plain', towerIndex);
        e.target.classList.add('dragging');
    }

    getElement() {
        if (!this.element) {
            this.createDiskElement();
        }
        return this.element;
    }

    getSize() {
        return this.size;
    }
}