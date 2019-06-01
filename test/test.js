const auto = require('..');
const _ = require('lodash');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const {expect, assert} = chai;


const sleep = dur => new Promise((res, rej) => {
	setTimeout(res, dur);
});

describe('auto', () => {

    it('basics', (done) => {
        var callOrder = [];
        auto({
			task1: ['task2', async () => {
				await sleep(25);
				callOrder.push('task1')
			}],
			async task2() {
				await sleep(50)
                callOrder.push('task2');
            },
            task3: ['task2', function(){
                callOrder.push('task3');
            }],
            task4: ['task1', 'task2', function(){
                callOrder.push('task4');
            }],
            task5: ['task2', async function(){
				await sleep(0)
				callOrder.push('task5');
            }],
            task6: ['task2', function(){
                callOrder.push('task6');
            }]
		})
			.then(results => {
				assert.deepEqual(callOrder,['task2','task3','task6','task5','task1','task4'])
				done()
			});
    });

    it('auto concurrency', (done) => {
        var concurrency = 2;
        var runningTasks = [];

        function makeCallback(taskName) {
			return new Promise(res => {
                runningTasks.push(taskName);
                setTimeout(() => {
                    // Each task returns the array of running tasks as results.
                    var result = runningTasks.slice(0);
                    runningTasks.splice(runningTasks.indexOf(taskName), 1);
					res(result)
                });
			}) 
        }

        auto({
            task1: ['task2', () => makeCallback('task1')],
            task2: () => makeCallback('task2'),
            task3: ['task2', () => makeCallback('task3')],
            task4: ['task1', 'task2', () => makeCallback('task4')],
            task5: ['task2', () => makeCallback('task5')],
            task6: ['task2', () => makeCallback('task6')]
		}, concurrency)
			.then(results => {
				_.each(results, (result) => {
					expect(result.length).to.be.below(concurrency + 1);
				});
				done();
        	});
    });

    it('auto petrify', done => {
        var callOrder = [];
        auto({
            task1: ['task2', async function (results) {
				await sleep(100);
				callOrder.push('task1');
            }],
            async task2 () {
				await(200);
				callOrder.push('task2');
            },
            task3: ['task2', function (results) {
                callOrder.push('task3');
            }],
            task4: ['task1', 'task2', function (results) {
                callOrder.push('task4');
            }]
		})
			.then( () => {
				expect(callOrder).to.eql(['task2', 'task3', 'task1', 'task4']);
				done();
			});
    });

    it('auto results', (done) => {
        var callOrder = [];
        auto({
            task1: ['task2', async function(results){
				expect(results.task2).to.eql('task2');
				await sleep(25);
				callOrder.push('task1');
				return ['task1a', 'task1b']
           }],
            async task2(){
				await sleep(50)
				callOrder.push('task2');
				return 'task2'
            },
            task3: ['task2', function(results){
                expect(results.task2).to.eql('task2');
                callOrder.push('task3');
            }],
            task4: ['task1', 'task2', function(results){
                expect(results.task1).to.eql(['task1a','task1b']);
                expect(results.task2).to.eql('task2');
                callOrder.push('task4');
                return 'task4';
            }]
		})
			.then( results => {
				expect(callOrder).to.eql(['task2','task3','task1','task4']);
				expect(results).to.eql({task1: ['task1a','task1b'], task2: 'task2', task3: undefined, task4: 'task4'});
				done();
			});
    });

    it('auto empty object', (done) => {
		auto({})
			.then(result => {
				expect(result).to.equal(null)
				done();
			}
		);
    });

    it('auto error', (done) => {
        auto({
            task1(){
                return 'testerror';
            },
            task2: ['task1', function(){
                throw new Error('task2 should not be called');
            }],
            task3(){
                return 'testerror2';
            }
		})
			.catch(err => {
				expect(err.message).to.equal('task2 should not be called');
				done()
			})
    });

    it('auto no callback', (done) => {
        auto({
            task1(){},
            task2: ['task1', function(){ done(); }]
        });
    });

    it('auto concurrency no callback', (done) => {
        auto({
            task1(){},
            task2: ['task1', function(){ done(); }]
        }, 1);
    });

    it('auto error should pass partial results', (done) => {
        auto({
            task1(){
                return 'result1';
            },
            task2: ['task1', function(){
				throw 'testerror'
            }],
            task3: ['task2', function(){
                throw new Error('task3 should not be called');
            }]
		})
			.catch(err => {
				expect(err).to.equal('testerror');
				done();
			})
    });

    it('auto removeListener has side effect on loop iteratee', (done) => {
        auto({
            task1: ['task3', function() { done(); }],
            task2: ['task3', function() {}],
            task3() {}
        });
    });

	it('auto calls callback multiple times', done => {
        var finalCallCount = 0;
		auto({
			task1() { return null; },
			task2: ['task1', function() { return null; }]
		})
			.then(() => {
				finalCallCount++;
				var e = new Error('An error');
				e._test_error = true;
				throw e;
			})
			.catch(e => {
				if (!e._test_error) throw e;
			})
		setTimeout(() => {
			expect(finalCallCount).to.equal(1);
			done();
		}, 10)	
    });


    it('auto calls callback multiple times with parallel functions', (done) => {
        auto({
            async task1() { sleep(0); throw 'err'; },
            async task2() { sleep(0); throw 'err'; },
		})
			.catch(err => {
				expect(err).to.equal('err');
				done();
			})
    });


    it('auto modifying results causes final callback to run early', (done) => {
        auto({
            task1(){
                return 'task1';
            },
            task2: ['task1', async function(results, callback){
				results.inserted = true;
				await sleep(50);
                return 'task2';
            }],
            async task3(){
				await sleep(100)
				return 'task3';
            }
		})
			.then(results => {
				expect(results.inserted).to.equal(true);
				expect(results.task3).to.equal('task3');
				done();
			})
    });

    // // Issue 263 on github: https://github.com/caolan/async/issues/263
    // it('auto prevent dead-locks due to inexistant dependencies', (done) => {
    //     expect(() => {
    //         auto({
    //             task1: ['noexist', function(){
    //                 return 'task1';
    //             }]
    //         });
    //     }).to.throw(/dependency `noexist`/);
    //     done();
    // });

    it('auto prevent dead-locks due to cyclic dependencies', (done) => {
		expect(auto({
				task1: ['task2', function(){
					return 'task1';
				}],
				task2: ['task1', function(){
					return 'task2';
				}]
			})
		).to.eventually.throw();
		done();
    });

    it('extended cycle detection', (done) => {
        var task = function (name) {
            return function () {
                return 'task ' + name;
            };
        };
        expect(
            auto({
                a: ['c', task('a')],
                b: ['a', task('b')],
                c: ['b', task('c')]
			})
		).to.eventually.throw();
		setTimeout(done, 200)
    });

    it('auto stops running tasks on error', (done) => {
        auto({
            task1 () {
                throw 'error';
            },
            task2 () {
                throw new Error('test2 should not be called');
            }
		}, 1)
			.catch(error => {
				expect(error).to.equal('error');
				done();
			});
    });

    it('ignores results after an error', (done) => {
        auto({
            async task1 () {
				await sleep(25);
				throw 'error'
            },
            async task2 (cb) {
				await sleep(30);
            },
            task3: ['task2', function () {
                throw new Error("task should not have been called");
            }]
		})
			.catch(err => {
				expect(err).to.equal('error');
				setTimeout(done, 25);
			});
    });

    it('should handle array tasks with just a function', (done) => {
        auto({
            a: [function () {
                return 1;
            }],
            b: ["a", function (results) {
                expect(results.a).to.equal(1);
            }]
        }).then(() => done());
    });

    it('should report errors when a task name is an array method', (done) => {
        auto({
            one() {
                throw 'Something bad happened here';
            },
            async filter() {
				await sleep(25);
				return 'All fine here though';
            },
            finally: ['one', 'filter', async function () {
				await sleep(0)
            }]
		})
			.catch(err => {
				expect(err).to.equal('Something bad happened here');
				done();
			});
    });

    it('should report errors when a task name is an obj prototype method', (done) => {
        auto({
            one () {
                throw 'Something bad happened here';
            },
            async hasOwnProperty () {
				await sleep(25)
				return 'All fine here though';
            },
            finally: ['one', 'hasOwnProperty', async function () {
				await sleep(0);
            }]
		})
			.catch(err => {
				expect(err).to.equal('Something bad happened here');
				done()
			});
    });

});