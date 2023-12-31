import React, {useEffect, useRef} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import * as d3 from 'd3';


//TODO: modify this to make a new glyph that captures both the in-plane velocity and concentration
//example function/code for making a custom glyph
//d is the data point {position, velocity,concentration}, axis is ['x','y','z'], scale is optional value to pass to help scale the object size
function makeVelocityGlyph(d,axis,scale=1){
    var xv = d.velocity[1]/0.25;
    var yv = d.velocity[2]/0.25;
    if(axis == 'y'){
        xv = d.velocity[0]/1.25;
        yv =  d.velocity[1]/1.25;
    } else if(axis == 'z'){
        xv = d.velocity[0]/0.5;
    }

    let xpos = xv/scale
    let ypos = yv/scale
    // let path = 'M ' + xpos + ',' + ypos + ' '
    //     + -ypos/3 + ',' + xpos/3 + ' '
    //     + ypos/3 + ',' + -xpos/3 + 'z'

    // let CirclePath = 'M ' + xpos + ' ' + ypos + ' ' +
    //     'm -' + (d.concentration/20) + ' 0 ' +
    //     'a ' + (d.concentration/20) + ' ' + (d.concentration/20) + ' 0 1 1 ' + ((d.concentration/20) * 2) + ' 0 ' +
    //     'a ' + (d.concentration/20) + ' ' + (d.concentration/20) + ' 0 1 1 -' + ((d.concentration/20) * 2) + ' 0 ' +
    //     'z'

    // path += CirclePath

    let CircleRadius = d.concentration/20
    let CirclePath = 'M ' + xpos + ' ' + ypos + ' ' +
        'm -' + (CircleRadius) + ' 0 ' +
        'a ' + (CircleRadius) + ' ' + (CircleRadius) + ' 0 1 1 ' + ((CircleRadius) * 2) + ' 0 ' +
        'a ' + (CircleRadius) + ' ' + (CircleRadius) + ' 0 1 1 -' + ((CircleRadius) * 2) + ' 0 ' +
        'z';

    let path = 'M ' + xpos + ',' + ypos + ' '
        + -ypos/3 + ',' + xpos/3 + ' '
        + ypos/3 + ',' + -xpos/3 + 'z'

    return { path: path, CirclePath: CirclePath };
}

export default function LinkedViewD3(props){
    //this is a generic component for plotting a d3 plot
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);

    const margin = 10;
    //sets a number of the number of particles we show when the brushed area has is too large
    const maxDots = 2000;
    
    //draw the points in the brushed area
    useEffect(()=>{
        if(svg !== undefined & props.data !== undefined & props.bounds !== undefined){
            //filter data by particles in the brushed region
            const bDist = d => props.brushedCoord - props.getBrushedCoord(d);
            function isBrushed(d){
                return Math.abs(bDist(d)) < props.brushedAreaThickness;
            }
            var data = props.data.filter(isBrushed);

            //-----
            // output value of textbox
            console.log(props.textBoxValue)

            //-----

            const bounds = props.bounds;
            console.log('bounds',bounds)
            var xExtents = [bounds.minZ, bounds.maxZ];
            var yExtents = [bounds.minY, bounds.maxY];
            if(props.brushedAxis === 'y'){
                xExtents = [bounds.minX, bounds.maxX];
                yExtents = [bounds.minZ, bounds.maxZ];
            } else if(props.brushedAxis === 'z'){
                xExtents = [bounds.minX, bounds.maxX];
            }

            var getX = d => d.position[1];
            var getY = d => d.position[2];
            if(props.brushedAxis == 'y'){
                getX = d => d.position[0];
                getY = d => d.position[1];
            } else if(props.brushedAxis == 'z'){
                getX = d => d.position[0];
            }

            console.log("This is the complete data: \n", data)
            //TODO: filter out points with a concentration of less than 80% of the maximum value of the current filtered datapoints
            // const ConcentrationLimit = 0.7 * d3.max(data, (d) => d.concentration);
            const ConcentrationLimit = (parseInt(props.textBoxValue, 10)/100) * d3.max(props.data, (d) => d.concentration);
            data = data.filter((d) => d.concentration >= ConcentrationLimit);
            console.log("This is the filtered data: \n", data)
    
            //limit the data to a maximum size to prevent occlusion
            data.sort((a,b) => bDist(a) - bDist(b));
            if(data.length > maxDots){
                data = data.slice(0,maxDots);
            }

            const getVelocityMagnitude = d => Math.sqrt(d.velocity[0]**2 + d.velocity[1]**2 + d.velocity[2]**2);
            const vMax = d3.max(data,getVelocityMagnitude);
            
            //custom radius based on number of particles
            const radius = Math.max(3*Math.min(width,height)/data.length,5);

            //scale the data by the x and z positions
            let xScale = d3.scaleLinear()
                .domain(xExtents)
                .range([margin+radius,width-margin-radius])

            let yScale = d3.scaleLinear()
                .domain(yExtents)
                .range([height-margin-radius,margin+radius])

            // let colorScale = d3.scaleLinear()
            //     .domain(yExtents)
            //     .range(props.colorRange);

            var colour_extent = [ConcentrationLimit, bounds.maxC]
            let colorScale_custom = d3.scaleLinear()
                .domain(colour_extent)
                .range(props.colorRange);

            //TODO: map the color of the glyph to the particle concentration instead of the particle height
            let dots = svg.selectAll('.Arrowglyph').data(data,d=>d.id)
            dots.enter().append('path')
                .attr('class','Arrowglyph')
                .merge(dots)
                .transition(25)
                .attr('d', d => makeVelocityGlyph(d,props.brushedAxis,.25*vMax/radius).path)
                .attr('fill',d=>colorScale_custom(d.concentration))
                // .attr('stroke','black')
                .attr('stroke-width',.1)
                .attr('transform',d=>'translate(' + xScale(getX(d)) + ',' + yScale(getY(d)) + ')')
                .attr('opacity', d => (d.concentration)/357);

            dots.exit().remove()

            let Circledots = svg.selectAll('.Circleglyph').data(data,d=>d.id)
            Circledots.enter().append('path')
                .attr('class','Circleglyph')
                .merge(Circledots)
                .transition(25)
                .attr('d', d => makeVelocityGlyph(d,props.brushedAxis,.25*vMax/radius).CirclePath)
                .attr('fill', 'steelblue')
                .attr('stroke','black')
                .attr('stroke-width',.2)
                .attr('transform',d=>'translate(' + xScale(getX(d)) + ',' + yScale(getY(d)) + ')')
                .attr('opacity', 0.15);

            Circledots.exit().remove()

            // let Circledots = svg.selectAll('.Circleglyph').data(data,d=>d.id)
            // Circledots.enter().append('CirclePath')
            //     .attr('class','Circleglyph')
            //     .merge(Circledots)
            //     .transition(100)
            //     .attr('d', d => makeVelocityGlyph(d,props.brushedAxis,.25*vMax/radius).CirclePath)
            //     .attr('fill',d=>colorScale_custom(d.concentration))
            //     .attr('stroke','black')
            //     .attr('stroke-width',.1)
            //     .attr('transform',d=>'translate(' + xScale(getX(d)) + ',' + yScale(getY(d)) + ')')
            //     // .attr('opacity', d => (d.concentration)/357);

            // Circledots.exit().remove()
        }
    },[svg,props.data,props.getBrushedCoord,props.bounds])

    
    return (
        <div
            className={"d3-component"}
            style={{'height':'99%','width':'99%'}}
            ref={d3Container}
        ></div>
    );
}
