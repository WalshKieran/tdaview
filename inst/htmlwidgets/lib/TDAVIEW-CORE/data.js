const DATA_TYPE_NUMBER = 1;
const DATA_TYPE_CATEGORY = 2;
const DATA_TYPE_ID = 3;
const DATA_TYPE_DATE = 4;

class Utility {
    static Min(array) {
        return Math.min(...array);
    }

    static Max(array) {
        return Math.max(...array);
    }

    static Mean(array) {
        let mean = 0;
        for(let i=0; i<array.length; i++) {
            mean += array[i];
        }
        return mean / array.length;
    }

    static SD(array) {
        let sd = 0;
        let mean = this.Mean(array);
        for(let i=0; i<array.length; i++) {
            sd +=  Math.pow(array[i] - mean, 2);
        }
        sd /= array.length;
        return Math.sqrt(sd);
    }

    static Normalised(value, min, max) {
        return (value - min) / (max - min);
    }
}

class Data {
    static generateRandom() {
        var mapper = {};
        var metadata = {};
        mapper.num_vertices = 100;
        mapper.adjacency = new Array(mapper.num_vertices);
        mapper.points_in_vertex = new Array(mapper.num_vertices);
        var num_points = mapper.num_vertices * 20;
        metadata.Intake = new Array(num_points);
        metadata.Condition = new Array(num_points);
        var condition_categories = ["None", "Mild", "Moderate", "Severe"];
        for(let i=0; i<mapper.adjacency.length; i++) {
            mapper.adjacency[i] = new Array(mapper.num_vertices);
            for(let j=0; j<mapper.adjacency[i].length; j++) {
                mapper.adjacency[i][j] = Math.round(Math.random()*0.508);
            }
            metadata.Intake[i] = Math.random();
            metadata.Condition[i] = condition_categories[Math.floor(Math.random() * (condition_categories.length-1))];
            mapper.points_in_vertex[i] = [i+1];
        }

        for(let i=mapper.num_vertices; i<num_points; i++) {
            metadata.Intake[i] = Math.random();
            metadata.Condition[i] = condition_categories[Math.round(Math.random() * (condition_categories.length-1))];
            mapper.points_in_vertex[Math.round(Math.random() * (mapper.num_vertices-1)) ].push(i+1);
        }

        let labels = Array.from({length: mapper.num_vertices}, (_, i) => "Node " + i);

        return new Data(mapper, metadata, labels);
    }

    constructor(mapper, metadata, labels) {
        this.metadata = metadata;
        this.adjacency = mapper.adjacency;
        this.maxBinPoints = Utility.Max(mapper.points_in_vertex.map(obj => Object.keys(obj).length));

        this.name = undefined;
        this.variable = new CachedVariable();
        this.mins = new ContinuousVariable();
        this.maxs = new ContinuousVariable();
        this.hasLabels = (labels != undefined);

        //Create bins for each node
        this.bins = new Array(mapper.num_vertices);
        for(let i=0; i<mapper.num_vertices; i++) {
            this.bins[i] = new Bin(Object.values(mapper.points_in_vertex[i]).map(index => index - 1), labels ? labels[i] : undefined);
        }

        //Determine defined types of variables
        this.types = {};
        for(var key in metadata) {
            let data = this.metadata[key];
            for(let i=0; i<data.length; i++) {
                if(data[i] !== null) {
                    this.types[key] = isNaN(data[i]) ? DATA_TYPE_CATEGORY : DATA_TYPE_NUMBER;
                    break;
                }
            }
        }
    }

    getHasLabels() {
        return this.hasLabels;
    }

    getAdjacency() {
        return this.adjacency;
    }

    getBins() {
        return this.bins;
    }

    loadVariable(name) {
        if(this.metadata.hasOwnProperty(name) && name !== this.name) {
            this.name = name;
            this.variable.setIsCategorical(this.types[name] === DATA_TYPE_CATEGORY);
            if(this.variable.getIsCategorical()) {
                this.variable.getCategorical().setFromEntries(this.metadata[name]);
                for(let i=0; i<this.bins.length; i++) {
                    let entries = this.bins[i].points.map(value => this.metadata[name][value]);
                    this.bins[i].getCategorical().setFromEntries(entries);
                }
            } else {
                this.variable.getContinuous().setFromEntries(this.metadata[name]);
                this.mins.setProperties(Infinity, Infinity, Infinity, Infinity);
                this.maxs.setProperties(-Infinity, -Infinity, -Infinity, -Infinity);
                for(let i=0; i<this.bins.length; i++) {
                    let localVariable = this.bins[i].getContinuous();
                    localVariable.setFromEntries(this.bins[i].points.map(value => this.metadata[name][value]));
                    this.mins.transformProperties(localVariable, Math.min);
                    this.maxs.transformProperties(localVariable, Math.max);
                }
            }
        }
        
    }

    getContinuousNormalised(bin, property) {
        return Utility.Normalised(bin.getContinuous()[property], this.mins[property], this.maxs[property]);
    }

    getContinuousMin(property) {
        return this.mins[property];
    }   

    getContinuousMax(property) {
        return this.maxs[property];
    }

    getPointsNormalised(bin) {
        return bin.getPointCount() / this.maxBinPoints;
    }

    getVariable() {
        return this.variable;
    }

    getVariableNames() {
        return Object.keys(this.metadata);
    }

    getContinuousNames() {
        return this.getVariableNames().filter(name => this.types[name] === DATA_TYPE_NUMBER);
    }

    getCategoricalNames() {
        return this.getVariableNames().filter(name => this.types[name] === DATA_TYPE_CATEGORY);
    }
}


class ContinuousVariable {
    constructor(min=0, max=0, mean=0, sd=0) {
        this.setProperties(min, max, mean, sd);
    }

    setFromEntries(entries) {
        this.setProperties(Utility.Min(entries), Utility.Max(entries), Utility.Mean(entries), Utility.SD(entries));
    }

    setProperties(min, max, mean, sd) {
        this.min = min;
        this.max = max; 
        this.mean = mean;
        this.sd = sd;
    }

    transformProperties(variable, func) {
        this.min = func(this.min, variable.min);
        this.max = func(this.max, variable.max);
        this.mean = func(this.mean, variable.mean);
        this.sd = func(this.sd, variable.sd);
    }
}

class CategoricalVariable {
    constructor(counts=undefined, sum=undefined) {
        this.counts = counts;
        this.sum = sum;
    }

    setFromEntries(entries) {
        var counts = {};
        for(let i=0; i<entries.length; i++) {
            counts[entries[i]] = (counts[entries[i]] || 0) + 1;
        }
        this.setProperties(counts, entries.length);
    }

    setProperties(counts, sum) {
        this.counts = counts;
        this.sum = sum;
    }

    getCount(category) {
        return this.counts[category] || 0;
    }

    getSum() {
        return this.sum;
    }

    getCategories() {
        return Object.keys(this.counts);
    }

    getValues() {
        return Object.values(this.counts);
    }

    getValuesNormalised() {
        return Object.values(this.counts).map(value => value / this.sum);
    }
}

class CachedVariable {
    constructor() {
        this.isCatagorical = undefined;
        this.continuous = new ContinuousVariable();
        this.categorical = new CategoricalVariable();
    }

    setIsCategorical(isCatagorical) {
        this.isCatagorical = isCatagorical;
    }

    getIsCategorical() {
        return this.isCatagorical;
    }

    getCategorical() {
        return this.categorical;
    }

    getContinuous() {
        return this.continuous;
    }
}

class Bin extends CachedVariable {
    constructor(points, name = undefined) {
        super();
        this.points = points;
        this.name = name;
    }

    getName() {
        return this.name;
    }

    getPointCount() {
        return this.points.length;
    }
}