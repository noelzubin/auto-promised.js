auto-promised.js
================

async.auto but with promises.

Installation:
-------------
npm install auto-promised

Usage:
------
``` js
const sleep = dur => new Promise((res, rej) => {
	setTimeout(res, dur);
});

auto({
    task1: ['task2', async (results) => {
        console.log('in task1 with results ', results);
        await sleep(25);
        return 1
    }],
    async task2() {
        await sleep(50)
        return 2
    },
    task3: ['task2', function(){
        return 3
    }],
    task4: ['task1', 'task2', function(){
        return 4
    }],
    task5: ['task2', async function(){
        await sleep(0)
        return 5
    }],
    task6: ['task2', function(){
        return 6
    }]
})
    .then(results => {
        console.log(results)
    });

// in task1 with results  { task2: 2 }
// { task2: 2, task3: 3, task6: 6, task5: 5, task1: 1, task4: 4 }
```


