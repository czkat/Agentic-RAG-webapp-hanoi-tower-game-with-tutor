class Tower {
    constructor(index) {
        this.index = index;
        this.disks = [];
        this.element = document.querySelector(`.tower[data-index="${index}"]`);
        
        // Set up drop events
        this.setupDropEvents();
    }
    
    setupDropEvents() {
        this.element.addEventListener('dragover', e => e.preventDefault());
        this.element.addEventListener('dragenter', e => e.preventDefault());
        this.element.addEventListener('drop', e => this.handleDrop(e));
    }
    
    handleDrop(e) {
        e.preventDefault();
        const fromTowerIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toTowerIndex = parseInt(e.currentTarget.dataset.index);
        
        // Remove dragging class from all disks
        document.querySelectorAll('.disk').forEach(disk => {
            disk.classList.remove('dragging');
        });
        
        if (fromTowerIndex !== toTowerIndex) {
            window.game.moveDisk(fromTowerIndex, toTowerIndex);
        }
    }

    addDisk(disk) {
        this.disks.push(disk);
    }

    removeDisk() {
        return this.disks.pop();
    }

    getTopDisk() {
        if (this.disks.length === 0) return null;
        return this.disks[this.disks.length - 1];
    }

    getTopDiskSize() {
        if (this.disks.length === 0) return Infinity;
        return this.disks[this.disks.length - 1].getSize();
    }

    isEmpty() {
        return this.disks.length === 0;
    }

    render() {
        this.element.innerHTML = '';
        this.disks.forEach(disk => {
            this.element.appendChild(disk.getElement());
        });
    }
}