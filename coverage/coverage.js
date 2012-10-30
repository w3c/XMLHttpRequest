var showCoverage = (function( $ ) {

var handleOptions = (function() {
		var defaultOptions = {
				suite: "",
				exclude: ".no-num, .no-test, .no-toc"
			};
		return function( options ) {
			options = $.extend( {}, defaultOptions, options );
			if ( !$.isArray( options.suite ) ) {
				options.suite = ( ( options.suite || "" ) + "" ).split( /\s+/ );
			}
			return options;
		};
	})();

function buildHierarchy( headers ) {
	var hierarchy = {},
		list = [];
	headers.each(function() {
		var level = list.length,
			newLevel = this.tagName.replace( /^h/i, "" );
		if ( newLevel <= level ) {
			for( var i = newLevel; i <= level; i++ ) {
				list.pop();
			}
			hierarchy[ this.id ] = list.slice();
		} else {
			for ( var i = level; i < newLevel - 1; i++ ) {
				list.push( undefined );
			}
			list.push( this.id );
		}
	});
	return hierarchy;
}

function testHeader( tests, engines, orphans ) {
	var count = 0,
		orphanCount = 0,
		states = {},
		table = $("<table>").addClass("test-switch"),
		enginesHeaders = $("<tr>"),
		names, tmp;
	$.each( engines, function( engine ) {
		enginesHeaders.append( $("<th>").text( engine ) );
	});
	table.append(
		enginesHeaders
		.prepend("<th></th><th>ID</th><th>TITLE</th>" )
	);
	function addLine( test, isOrphan ) {
		var tr = $("<tr>")
				.append( $("<th>").text( isOrphan ? "??" : "" ) )
				.append( $("<td>").text(test.suite + "/" + test.id) )
				.append( $("<td>").text(test.title) )
				.appendTo( table ),
			state;
		$.each( engines, function( engine ) {
			var testResult = test.results && test.results[ engine ] || "not-ran";
			if ( testResult ) {
				if ( state === undefined ) {
					state = testResult;
				} else if ( state !== testResult ) {
					state = "inconsistent";
				}
			}
			tr.append(
				$("<th>")
				.text( testResult )
				.addClass( testResult ? "test-results-" + testResult : "" )
			);
		});
		state = state
		if ( !states[ state ] ) {
			states[ state ] = 1;
		} else {
			states[ state ]++;
		}
	}
	$.each( tests || [], function( _, test ) {
		count++;
		addLine( test );
	});
	$.each( orphans || [], function( _, test ) {
		orphanCount++;
		addLine( test, true );
	});
	if ( orphanCount > 0 ) {
		states.orphan = orphanCount;
	}
	if ( count || orphanCount ) {
		names = [];
		$.each( states, function( state ) {
			names.push( state );
		});
		names.sort();
		tmp = [];
		$.each( names, function( _, state ) {
			tmp.push( state + ": " + states[ state ] );
		});
		tmp = tmp.join(", ");
		return $("<div>")
			.addClass("test-coverage")
			.append("<h6>Test Coverage</h6>")
			.append("<span class='test-switch' style='display:none'>&uarr;</span><span class='test-switch'>&darr;</span>&nbsp;")
			.append(
				$("<a href='#'>")
					.addClass( count ? "show-test" : "" )
					.text(
						count + " test" + ( count > 1 ? "s" : "" ) +
						" ( " + tmp + " )" 
					)
			)
			.append( table );
	}
	return $("<div>")
		.addClass("test-coverage")
		.addClass("test-coverage-none")
		.text("NO TEST")
		.append("<h6>No Test Coverage</h6>");
}

function whenMap( array, mapCallback ) {
	return $.when.apply( $, $.map(array,mapCallback) );
}

return function ( options ) {
	options = handleOptions( options );
	var testsForSection = {},
		tests = {},
		orphans = {},
		engines = {},
		headers, hierarchy;
	function addToSection( idSection, TestOrTestsMap ) {
		var map, id;
		if ( idSection && TestOrTestsMap ) {
			if ( TestOrTestsMap.id ) {
				map = {};
				map[ TestOrTestsMap.id ] = TestOrTestsMap;
			} else {
				map = TestOrTestsMap;
			}
			if ( !testsForSection[ idSection ] ) {
				testsForSection[ idSection ] = {};
			}
			$.extend( testsForSection[ idSection ], map );
			for ( id in map ) {
				if ( id in orphans ) {
					delete orphans[ id ];
				}
			}
		}
	}
	function dataForTest( id, data ) {
		if ( !tests[ id ] ) {
			tests[ id ] = orphans[ id ] = data;
		} else {
			$.extend( tests[ id ], data );
		}
	}
	$(function() {
		headers = $("h1, h2, h3, h4, h5, h6");
		if ( options.exclude ) {
			headers = headers.not( options.exclude );
		}
		hierarchy = buildHierarchy( headers );
	});
	$.when(
		whenMap( options.suite, function( testCase ) {
			return $.ajax( "http://w3c-test.org/framework/api/test-cases/" + testCase, {
				dataType: "json"
			}).done(function( data ) {
				$.each( data, function( _, test ) {
					dataForTest( test.id, {
						id: test.id,
						title: test.title,
						suite: testCase
					});
					$.each( test && test.specURIs || [], function( _, specURIs ) {
						addToSection( specURIs.uri.split("#")[ 1 ], tests[ test.id ] );
					});
				});
			}).fail(function( error ) {
				console.log( "Problem loading test case '" + testCase + "'" );
			}).then( null, function() {
				return $.Deferred().resolve();
			})
		}),
		whenMap( options.suite, function( testCase ) {
			return $.ajax( "http://w3c-test.org/framework/api/result/" + testCase, {
				dataType: "json"
			}).done(function( data ) {
				$.each( data, function( _, test ) {
					var results = {};
					$.each( test.results_by_engine, function( engine, map ) {
						if ( !engines[ engine ] ) {
							engines[ engine ] = true;
						}
						for( var key in map ) {
							results[ engine ] = map[ key ].result;
							return;
						}
					});
					dataForTest( test.id, {
						id: test.id,
						title: test.title,
						results: results,
						suite: testCase
					});
				});
			}).fail(function( error ) {
				console.log( "Problem loading result '" + testCase + "'" );
			}).then( null, function() {
				return $.Deferred().resolve();
			})
		})
	).done(function() {
		$(function() {
			$.each( testsForSection, function( id, tests ) {
				$.each( hierarchy[ id ] || [], function( _, idParent ) {
					addToSection( idParent, tests );
				});
			});
			headers.each(function() {
				$( this ).after( testHeader(testsForSection[this.id],engines,orphans) );
				orphans = undefined;
			});
			$("body").on( "click", "div.test-coverage a", function( e ) {
				e.preventDefault();
				$( this ).parent("div.test-coverage").find(".test-switch").toggle();
			});
	  	});
	});
}

})( jQuery );
