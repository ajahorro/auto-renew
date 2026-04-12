const ServiceCard = ({ service, addToCart }) => {

return(

<div className="card">

<h3>{service.name}</h3>

<p>{service.description}</p>

<p><strong>Price:</strong> ₱{service.price}</p>

<p><strong>Duration:</strong> {service.durationMin} minutes</p>

<button onClick={()=>addToCart(service)}>
Add to Cart
</button>

</div>

)

}

export default ServiceCard