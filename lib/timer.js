'use strict';

const Heap = require('@liqd-js/ds-heap');

const time_ms = () => Date.now();

module.exports = class Timer
{
	constructor()
	{
		this.index = new Map();
		this.heap = new Heap( ( a, b ) => a.deadline - b.deadline );
		this.timeout = null;
	}

	set( id, callback, timeout_ms, data )
	{
		if( typeof callback !== 'function' )
		{
			data = timeout_ms;
			timeout_ms = callback;
			callback = id;
			id = Timer.id( 'timer_id-' );
		}

		let timer = this.index.get( id ), reschedule, now = time_ms();

		if( timeout_ms > 315360000000 ){ timeout_ms -= now }

		if( timer )
		{
			reschedule = ( this.heap.top() === timer );

			timer.deadline = now + timeout_ms;
			timer.callback = callback;
			timer.data = data;
			timer.flow = typeof LIQD_FLOW !== 'undefined' ? LIQD_FLOW.save() : undefined;
			this.heap.update( timer );
		}
		else
		{
			timer = { id, deadline: now + timeout_ms, callback, data, flow: typeof LIQD_FLOW !== 'undefined' ? LIQD_FLOW.save() : undefined };

			this.index.set( id, timer );
			this.heap.push( timer );

			reschedule = ( this.heap.top() === timer );
		}

		if( reschedule )
		{
			if( this.timeout ){ clearTimeout( this.timeout ); }
			this.timeout = setTimeout( this._dispatch.bind(this), Math.max( 0, this.heap.top().deadline - time_ms() ));
		}

		return id;
	}

	postpone( id, timeout_ms )
	{
		let timer = this.index.get( id );

		if( timer )
		{
			let reschedule = ( this.heap.top() === timer );

			timer.deadline = time_ms() + timeout_ms;
			this.heap.update( timer );

			if( reschedule )
			{
				clearTimeout( this.timeout );
				this.timeout = setTimeout( this._dispatch.bind(this), Math.max( 0, this.heap.top().deadline - time_ms() ));
			}

			return true;
		}
		else{ return false; }
	}

	clear( id )
	{
		let timer = this.index.get( id );

		if( timer )
		{
			let reschedule = ( this.heap.top() === timer );

			this.index.delete( id );
			this.heap.delete( timer );

			if( reschedule )
			{
				clearTimeout( this.timeout );
				this.timeout = this.heap.top() ? setTimeout( this._dispatch.bind(this), Math.max( 0, this.heap.top().deadline - time_ms() )) : null;
			}

			return timer.data;
		}

		return undefined;
	}

	_dispatch()
	{
		let top, now = time_ms();

		while( ( top = this.heap.top() ) && ( top.deadline <= now + 7 ) )
		{
			let timer = this.heap.pop();
			this.index.delete( timer.id );

			if( timer.flow )
			{
				timer.flow.restore(() => { timer.callback( timer.data )});
			}
			else{ timer.callback( timer.data ); }
		}

		this.timeout = this.heap.top() ? setTimeout( this._dispatch.bind(this), Math.max( 0, this.heap.top().deadline - time_ms() )) : null;
	}

	static id( prefix )
	{
		return ( prefix ? prefix : 0 ) + (( time_ms() % 137438953472 ) * 65536 + Math.floor( Math.random() * 65536 ));
	}

	static global( name )
	{
		if( typeof global[name] === 'undefined' )
		{
			global[name] = new Timer();

			return true;
		}
		else{ return false; }
	}
}
