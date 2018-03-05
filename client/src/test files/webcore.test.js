class Container extends React.Component{
    constructor(props){
      super(props);
      this.state = {
        array: [],
      };

      this.handleClick = this.handleClick.bind(this);
      this.onChangeHandler = this.onChangeHandler.bind(this);
    }

    componentWillMount(){
      this.fetchData().then((data)=>{this.state={array: data}; 
                                      this.setState(this.state); 
                                      setTimeout(function() {
                                        document.getElementById("loader").style.display = "none";
                                        document.getElementById("root").style.display = "block";  
                                        document.getElementById("title").style.display="block";
                                      }, 1000);
                                    });
    }

    render(){
      return(
        <div id="itemlist">
          {this.getTags()}

          <button id="download-btn" onClick={this.handleClick}>Download Selected</button>
        </div>
      );
    }

    fetchData() {
      return new Promise((resolve, reject)=>{
          fetch("/files",{
          method: 'GET',
          headers: {
            Accept: 'application/json'
          }
        }).then(response => {
          if (response.ok) {
            response.json().then(json => {
              resolve(json);
            });
          }
        });
      });
    }

    getTags() {
        let array = [];
        for (var i = 0; i < this.state.array.length; i++) {
          array.push(<div key={i} className="item"><a className="link" href={`/download/${this.state.array[i].name}`}>{this.state.array[i].name}</a>
                <input className="checker" type="checkbox" onChange={this.onChangeHandler}></input>
                      </div>)
          }
        return array
    }

    onChangeHandler(e){
      e.target.value = e.target.checked;
    }

    handleClick(){
      let array = {links: document.getElementsByClassName('link'), checkbox: document.getElementsByClassName('checker')};

      for (var i = 0; i < array.checkbox.length; i++) {
        if(array.checkbox[i].value == "true"){
          window.open(array.links[i].href); 
        }
      }
    }
  }

  ReactDOM.render(<Container/>, document.getElementById('root') );