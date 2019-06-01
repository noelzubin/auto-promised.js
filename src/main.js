const auto = async (tasks, concurrency) => {

    const numTasks = Object.keys(tasks).length;
    if (!numTasks) return null;
    if (!concurrency) concurrency = numTasks;
    
    const results = {};
    let runningTasks = 0;
    
    const listeners = Object.create(null);
    const readyTasks = [];

    // for cycle detection:
    const readyToCheck = []; // tasks that have been identified as reachable
     // without the possibility of returning to an ancestor task
    const uncheckedDependencies = {};

	Object.keys(tasks).forEach(key => {
        var task = tasks[key]
        if (!Array.isArray(task)) {
            // no dependencies
            enqueueTask(key, [task]);
            readyToCheck.push(key);
            return;
        }
        
        var dependencies = task.slice(0, task.length - 1);
        var remainingDependencies = dependencies.length;
        if (remainingDependencies === 0) {
            enqueueTask(key, task);
            readyToCheck.push(key);
            return;
        }

        uncheckedDependencies[key] = remainingDependencies;
        dependencies.forEach(dependencyName => {
            if (!tasks[dependencyName]) {
                throw new Error('async.auto task `' + key +
                    '` has a non-existent dependency `' +
                    dependencyName + '` in ' +
                    dependencies.join(', '));
            }
            addListener(dependencyName, () => {
                remainingDependencies--;
                if (remainingDependencies === 0) {
                    enqueueTask(key, task);
                }
            });
        });
    });

    checkForDeadlocks();
    await processQueue();
    return results;

    async function taskComplete(taskName) {
        var taskListeners = listeners[taskName] || [];
		taskListeners.forEach(fn => fn());
        await processQueue();
    }
    
    async function runTask(key, task) {
        runningTasks++;
        const taskFn = task[task.length -1];
        results[key] = await taskFn(results);
        runningTasks--;
        await taskComplete(key)
    }

    function enqueueTask(key, task) {
        readyTasks.push( () => runTask(key, task));
    }

    async function processQueue() {
        const allPromises = [];

        if (readyTasks.length === 0 && runningTasks === 0) {
            return Promise.all(allPromises);
        }

        while(readyTasks.length && runningTasks < concurrency) {
            var run = readyTasks.shift();
            allPromises.push(run());
        }

        return Promise.all(allPromises);
    }

    function addListener(taskName, fn) {
        var taskListeners = listeners[taskName];
        if (!taskListeners) {
            taskListeners = listeners[taskName] = [];
        }
        taskListeners.push(fn);
    }

    function checkForDeadlocks() {
        // Kahn's algorithm
        // https://en.wikipedia.org/wiki/Topological_sorting#Kahn.27s_algorithm
        // http://connalle.blogspot.com/2013/10/topological-sortingkahn-algorithm.html
        var currentTask;
        var counter = 0;
        while (readyToCheck.length) {
            currentTask = readyToCheck.pop();
            counter++;
            getDependents(currentTask).forEach(dependent => {
                if (--uncheckedDependencies[dependent] === 0) {
                    readyToCheck.push(dependent);
                }
            });
        }
        if (counter !== numTasks) {
            throw new Error(
                'async.auto cannot execute tasks due to a recursive dependency'
            );
        }
    }
    
    function getDependents (taskName) {
        var result = [];
        Object.keys(tasks).forEach(key => {
            const task = tasks[key]
            if (Array.isArray(task) && task.indexOf(taskName) >= 0) {
                result.push(key);
            }
        });
        return result;
    }
}

// export default auto;
module.exports = auto;